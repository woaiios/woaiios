/**
 * LLMSenseSelector Module
 * 借助翻译大模型（hy-mt2-1.8b，经 OpenAI 兼容 API 远程端点提供）结合上下文为单词挑选最贴切的中文释义
 *
 * 模型: tencent/Hy-MT2-1.8B (默认权重路径见 LLMSenseSelector.DEFAULT_WEIGHT_PATH)
 * 工作方式 (How it works):
 * - 将多个待消歧的词条打包成批（默认 20 个/批），一次请求完成 (Batch words per request)
 * - 采用 Hy-MT2 结构化翻译风格：【背景信息】= 整段原文，【待翻译文本】= 词表
 * - 要求模型只返回词锚定 JSON: {"glosses":[{"word":"...","gloss":"..."},...]}，
 *   按 word 对齐防止漏项错位 (Word-anchored JSON output, aligned by word)
 * - 缓存为 GlossCache 单例（localStorage 持久化 + Google Drive 同步），失败后自动降级到本地启发式结果
 */
import { glossCache } from './GlossCache.js';

export class LLMSenseSelector {
    static LEGACY_ENDPOINT = 'https://pc-20260820eaeq.tailfbac23.ts.net:8443/v1/chat/completions';
    static PROXY_ENDPOINT = '/lm-studio/v1/chat/completions';
    static UNIFIED_PROXY = '/api/translate';
    static DEFAULT_MODEL = 'hy-mt2-1.8b';

    static resolveEndpoint() {
      try {
        const h = window.location.hostname;
        const isTS = h.endsWith('.ts.net') || /^100\.\d/.test(h) || h.includes('tailscale');
        if (isTS) {
          const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
          return `${proto}//${h}:8787/api/translate`;
        }
      } catch {}
      return null;
    }

    static defaultEndpoint() {
      try {
        const h = window.location.hostname;
        if (h) return `http://${h}:8787/api/translate`;
      } catch {}
      return 'http://localhost:8787/api/translate';
    }
    static DEFAULT_ENDPOINT = LLMSenseSelector.defaultEndpoint();
    // HuggingFace 仓库 / 本地权重路径（推理服务端应加载此权重并暴露为 DEFAULT_MODEL）
    static DEFAULT_WEIGHT_PATH = 'tencent/Hy-MT2-1.8B';

    constructor(options = {}) {
        const auto = LLMSenseSelector.resolveEndpoint();
        this.endpoint = options.endpoint || auto || LLMSenseSelector.DEFAULT_ENDPOINT;
        this.model = options.model || LLMSenseSelector.DEFAULT_MODEL;
        this.weightPath = options.weightPath || LLMSenseSelector.DEFAULT_WEIGHT_PATH;
        this.timeoutMs = options.timeoutMs ?? 150000;
        // Larger batches (20) keep request count low and let the model disambiguate
        // each word inside one shared context window instead of per-pair isolation.
        this.maxBatchSize = options.maxBatchSize ?? 20;
        // Hy-MT2-1.8B recommended generation params (see model card):
        // temperature 0.7, top_p 0.6, top_k 20, repetition_penalty 1.05
        this.temperature = options.temperature ?? 0.7;
        this.topP = options.topP ?? 0.6;
        this.topK = options.topK ?? 20;
        this.repetitionPenalty = options.repetitionPenalty ?? 1.05;
        // Per-entry nearby-sentence hint (kept short); the full passage is sent
        // separately as backgroundText so the model gets the whole context.
        this.maxContextChars = options.maxContextChars ?? 200;

        // 释义缓存（GlossCache 单例）：key = word::context，跨刷新持久化，
        // 并由 VocabularyManager 同步到 Google Drive。同一 key 的 get/set
        // 语义与普通 Map 一致。
        this.cache = options.cache || glossCache;   // key: word::context -> chinese gloss
        this.workingEndpoint = null;     // endpoint that last succeeded (sticky)
        this.consecutiveFailures = 0;
        this.disabled = false;           // circuit breaker
    }

    /**
     * 应用设置变更 (Apply settings)
     */
    configure({ endpoint, model } = {}) {
        if (endpoint && endpoint !== this.endpoint) {
            this.endpoint = endpoint;
            this.workingEndpoint = null;
        }
        if (model) this.model = model;
    }

    /**
     * 批量选择上下文释义 (Select senses for a list of occurrences)
     * @param {Array<{id:number|string, word:string, context:string, dictionarySenses:string}>} items
     * @returns {Promise<Map<string, string>>} id -> 中文释义
     */
    async selectSenses(items, { backgroundText } = {}) {
        this.backgroundText = backgroundText || this.backgroundText || '';
        const results = new Map();
        if (!items?.length || this.disabled) return results;

        // 确保持久化缓存已从 localStorage 加载完成，避免刚启动时误判未命中
        // (Ensure the persistent cache finished loading from localStorage)
        if (typeof this.cache.waitForLoad === 'function') {
            await this.cache.waitForLoad();
        }

        // 1. Serve cache hits directly
        const pending = [];
        for (const item of items) {
            const key = this.cacheKey(item.word, item.context);
            const cached = this.cache.get(key);
            if (cached) {
                results.set(item.id, cached);
            } else {
                pending.push(item);
            }
        }
        if (!pending.length) return results;

        // 2. Deduplicate identical word+context pairs inside this run
        const deduped = new Map();
        for (const item of pending) {
            const key = this.cacheKey(item.word, item.context);
            if (!deduped.has(key)) deduped.set(key, []);
            deduped.get(key).push(item);
        }

        // 3. Request chunks with limited parallelism (推理服务会并发处理各 chunk；
        //    wall-clock ≈ 最慢的一个而非总和)
        const entries = [...deduped.values()];
        const chunkGroups = [];
        for (let i = 0; i < entries.length; i += this.maxBatchSize) {
            if (this.disabled) break;
            chunkGroups.push(entries.slice(i, i + this.maxBatchSize).map(list => list[0]));
        }

        this.consecutiveFailures = 0;
        let next = 0;
        const CONCURRENCY = Math.min(3, chunkGroups.length);
        const worker = async () => {
            while (next < chunkGroups.length && !this.disabled) {
                const group = chunkGroups[next++];
                try {
                    await this.requestChunk(group, results, deduped, this.backgroundText);
                    this.consecutiveFailures = 0;
                } catch (error) {
                    this.consecutiveFailures += 1;
                    console.warn('⚠️ LLM sense selection failed:', error.message);
                    if (this.consecutiveFailures >= 4) {
                        this.disabled = true;
                        console.warn('⚠️ LLM sense selector disabled for this session (service unavailable?)');
                    }
                }
            }
        };
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        return results;
    }

    /**
     * 发送一批词条给模型并解析结果 (Send one chunk and parse)
     * 模型按 "Entry N"（分片内位置）应答，这里严格按位置回填到原始词条，
     * 不信任模型复述的编号。(Map strictly by position — never trust echoed ids)
     */
    async requestChunk(chunk, results, deduped, backgroundText) {
        const prompt = this.buildPrompt(chunk, backgroundText);
        let glosses = this.alignGlosses(this.parseGlossEntries(await this.chat(prompt)), chunk);

        // Degenerate-response guard: models sometimes just echo the few-shot
        // example values for every entry. Detect and force a real answer.
        if (this.isExampleEcho(glosses)) {
            console.warn('[LLM] example-echo detected, retrying');
            glosses = [];
        }

        if (this.countUsable(glosses, chunk) < chunk.length) {
            glosses = this.alignGlosses(
                this.parseGlossEntries(await this.chat(prompt + '\n请重新输出，必须返回严格的 {"glosses":[{"word":"...","gloss":"..."},...]} JSON 对象：每个词条一个元素，word 原样复制该英文单词，gloss 是其中文释义；不要遗漏、合并词条，也不要任何解释、思考标记或额外字段。')),
                chunk
            );
            if (this.isExampleEcho(glosses)) glosses = [];
        }

        if (this.countUsable(glosses, chunk) === 0) {
            throw new Error('Model returned no usable senses');
        }

        // Validated — commit to cache & results
        chunk.forEach((item, idx) => {
            const clean = this.sanitizeGloss(glosses[idx]);
            if (!clean) return;
            const key = this.cacheKey(item.word, item.context);
            this.cache.set(key, clean);
            for (const dup of deduped.get(key)) {
                results.set(dup.id, clean);
            }
        });
    }

    /**
     * 解析词锚定结果 (Parse word-anchored gloss entries)
     * 期望形如 {"glosses":[{"word":"supposed","gloss":"应该"},...]}；
     * 容忍思考散文、代码围栏、前后杂文本；纯字符串数组则回退为无锚定条目。
     */
    parseGlossEntries(text) {
        if (!text) return [];
        const raw = String(text).trim();

        const tryExtract = (obj) => {
            const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.glosses) ? obj.glosses : null);
            if (!arr) return null;
            const entries = arr.map((e) => {
                if (e && typeof e === 'object' && typeof e.gloss === 'string') {
                    return { word: String(e.word || '').trim().toLowerCase(), gloss: e.gloss };
                }
                if (typeof e === 'string') return { word: '', gloss: e };
                return null;
            }).filter(Boolean);
            return entries.length ? entries : null;
        };

        // Fast path: payload IS valid JSON
        try {
            const direct = tryExtract(JSON.parse(raw));
            if (direct) return direct;
        } catch { /* fall through to tolerant parsing */ }

        const cleaned = raw
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/```(?:json)?/gi, '');

        // Try every {...}/[...] block from LAST to FIRST (the final one is the answer)
        const blocks = [];
        const opens = [];
        for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === '{' || cleaned[i] === '[') opens.push(i);
            else if ((cleaned[i] === '}' || cleaned[i] === ']') && opens.length) blocks.push([opens.pop(), i]);
        }
        const candidates = blocks.sort((a, b) => b[0] - a[0]);
        for (const [s, e] of candidates) {
            try {
                const out = tryExtract(JSON.parse(cleaned.slice(s, e + 1)));
                if (out) return out;
            } catch { /* try next */ }
        }
        // Fallback: positional quoted CJK strings
        return this.parseSenseArray(raw, 0).map((g) => ({ word: '', gloss: g }));
    }

    /**
     * 按单词锚定对齐释义 (Align glosses by word anchor)
     * 只信 word 匹配（大小写不敏感）；匹配不上的词条留空（走重试或保留词典义），
     * 绝不按位置硬填，避免 1.8B 模型漏项导致整体错位。
     */
    alignGlosses(entries, chunk) {
        const out = new Array(chunk.length).fill('');
        if (!entries?.length) return out;
        const byWord = new Map();
        for (const e of entries) {
            if (e.word && e.gloss && !byWord.has(e.word)) byWord.set(e.word, e.gloss);
        }
        chunk.forEach((item, idx) => {
            const w = (item.word || '').toLowerCase();
            const g = byWord.get(w);
            if (g) out[idx] = g;
        });
        return out;
    }

    /**
     * 统计能通过清洗校验的释义数量 (Count positionally-valid glosses)
     */
    countUsable(glosses, chunk) {
        let n = 0;
        chunk.forEach((item, idx) => {
            if (this.sanitizeGloss(glosses[idx])) n += 1;
        });
        return n;
    }

    /**
     * 检测模型是否只是复制了提示词中的示例释义
     * (Detect lazy echo of prompt example values)
     */
    isExampleEcho(glosses) {
        const ECHO_SET = new Set(['银行', '岸', '应该', '霓虹灯']);
        const usable = glosses.filter(g => g && g.trim());
        return usable.length >= 2 && usable.every(g => ECHO_SET.has(g.trim()));
    }

    /**
     * 构造翻译/消歧提示词 (Build translation & disambiguation prompt)
     * 采用 Hy-MT2-1.8B 推荐的结构化数据翻译风格：
     *   - 【背景信息】= 整段原文（扩大上下文，供模型理解句子间语境）
     *   - 【待翻译文本】= 本批次待消歧的英文词表（保持顺序，结构锁定为 JSON）
     * 输出协议与 chat() 中的 json_schema 一致：{"glosses":[...]}，
     * glosses 是与词条顺序严格一致的字符串数组（位置式，防错位）。
     * 源语言 = 英语，目标语言 = 中文。
     */
    buildPrompt(chunk, backgroundText = '') {
        const wordLines = chunk.map((item, i) => {
            const ctx = this.truncateContext(item.context);
            let line = `- 词条${i + 1} "${item.word}"`;
            if (ctx) line += ` （附近小句：${ctx}）`;
            return line;
        }).join('\n');

        const bg = (backgroundText && backgroundText.trim()) ? backgroundText.trim() : '';
        const bgBlock = bg ? `【背景信息】\n${bg}\n\n` : '';

        return [
            '请结合【背景信息】将【待翻译文本】中列出的英文单词，翻译为其在语境中最贴切的中文短释义。',
            '注意**只需要输出翻译后的结果，不要额外解释**。',
            '严格约束：',
            '1. 结构锁定：必须返回 JSON 对象 {"glosses":[{"word":"...","gloss":"..."},...]}，glosses 数组与【待翻译文本】的词条一一对应：word 必须原样复制对应词条的英文单词，gloss 是该词的中文短释义。',
            '2. 选择性翻译：gloss 仅给出面向读者可见的中文释义，1-6 个汉字，最多不超过 10 个汉字；不要遗漏或合并任何词条。',
            '3. 禁止修改：word 字段只放原英文单词；不要输出英文释义、拼音、词性标注或任何解释文字。',
            '4. 短语整体释义：若单词属于短语动词或固定搭配（如 be supposed to、look at、pitch black、sort of），gloss 应给出该搭配在句中的整体含义，而非单词字面义。',
            '',
            bgBlock + '【待翻译文本】\n' + wordLines,
            '',
            '示例（仅示意结构，不要照搬内容）：{"glosses":[{"word":"supposed","gloss":"应该"},{"word":"neon","gloss":"霓虹灯"}]}'
        ].join('\n');
    }

    truncateContext(context = '') {
        const text = context.trim().replace(/\s+/g, ' ');
        if (text.length <= this.maxContextChars) return text;
        return text.slice(0, this.maxContextChars) + '…';
    }

        /**
         * 调用 OpenAI 兼容接口 (Call OpenAI-compatible chat completions)
         * 使用 response_format json_schema 结构化输出（OpenAI 兼容推理服务支持）：
         * 语法约束生成，保证返回纯 JSON 数组，便于直接解析。
         * 不兼容的服务端（返回 400/422）会自动去掉该参数重试一次。
         */
    async chat(prompt) {
        const auto = LLMSenseSelector.resolveEndpoint();
        const candidates = [
            this.workingEndpoint,
            this.endpoint,
            auto,
            LLMSenseSelector.UNIFIED_PROXY,
            LLMSenseSelector.PROXY_ENDPOINT,
            LLMSenseSelector.LEGACY_ENDPOINT
        ].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);

        const buildBody = (withSchema) => {
            const body = {
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                // Hy-MT2-1.8B recommended generation params (see model card):
                // temperature 0.7, top_p 0.6, top_k 20, repetition_penalty 1.05
                temperature: this.temperature,
                top_p: this.topP,
                top_k: this.topK,
                repetition_penalty: this.repetitionPenalty,
                // Structured output: grammar-constrained, always valid JSON.
                // Entries are word-anchored {"word","gloss"} objects so alignment
                // survives occasional dropped/merged entries from the 1.8B model.
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'chinese_glosses',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                glosses: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            word: { type: 'string' },
                                            gloss: { type: 'string' }
                                        },
                                        required: ['word', 'gloss'],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ['glosses'],
                            additionalProperties: false
                        }
                    }
                },
                // 1.8B translation model: cap output and let it finish
                max_tokens: 4096,
                // Context length budget (per Hy-MT2-1.8B): allow the large
                // background passage without truncating the model's window.
                max_model_len: 262144,
                stream: false
            };
            if (!withSchema) delete body.response_format;
            return body;
        };

        let lastError = null;
        for (const endpoint of candidates) {
            try {
                let response = await this.doFetch(endpoint, buildBody(true));
                // Older / incompatible OpenAI-compat servers reject response_format
                if (!response.ok && (response.status === 400 || response.status === 422)) {
                    console.log('[LLM] response_format rejected, retrying without schema');
                    response = await this.doFetch(endpoint, buildBody(false));
                }
                if (!response.ok) {
                    throw new Error(`LLM HTTP ${response.status} from ${endpoint}`);
                }
                const data = await response.json();
                const message = data?.choices?.[0]?.message;
                let content = message?.content;
                // Reasoning models may burn all tokens on hidden thinking and
                // leave `content` empty; fall back to parsing the reasoning text
                if (!content && message?.reasoning_content) {
                    content = message.reasoning_content;
                }
                if (!content) {
                    throw new Error(`Empty completion (${data?.choices?.[0]?.finish_reason || 'unknown'})`);
                }
                this.workingEndpoint = endpoint;
                return content;
            } catch (error) {
                lastError = error;
                // Abort/timeout/network errors: try next candidate endpoint
            }
        }
        throw lastError || new Error('LLM request failed');
    }

    /**
     * 带超时的 fetch（兼容无 AbortController 的旧 WebKit）
     */
    async doFetch(endpoint, bodyObj) {
        const fetchOpts = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj)
        };

        let timeoutReject;
        const timeoutPromise = new Promise((_, rej) => { timeoutReject = rej; });
        const timer = setTimeout(() => timeoutReject(new Error('LLM request timed out')), this.timeoutMs);

        if (typeof AbortController !== 'undefined') {
            const controller = new AbortController();
            fetchOpts.signal = controller.signal;
            setTimeout(() => controller.abort(), this.timeoutMs);
        }

        try {
            return await Promise.race([fetch(endpoint, fetchOpts), timeoutPromise]);
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * 从模型输出中提取释义数组 (Extract positional gloss array)
     * 期望形如 ["银行", "岸"]；容忍思考散文、代码围栏、前后杂文本。
     */
    parseSenseArray(text, expectedLen) {
        if (!text) return [];
        const raw = String(text).trim();

        // Fast path: structured output — payload IS valid JSON,
        // either {"glosses":[...]} or a bare [...]
        try {
            const direct = JSON.parse(raw);
            if (Array.isArray(direct)) return direct.filter(v => typeof v === 'string');
            if (direct && Array.isArray(direct.glosses)) {
                return direct.glosses.filter(v => typeof v === 'string');
            }
        } catch { /* fall through to tolerant parsing */ }

        const cleaned = raw
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/```(?:json)?/gi, '');

        // Try every [...] block from LAST to FIRST (models may draft early arrays
        // while thinking; the final one is the answer)
        const blocks = [];
        const opens = [];
        for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === '[') opens.push(i);
            else if (cleaned[i] === ']' && opens.length) blocks.push([opens.pop(), i]);
        }

        const candidates = blocks.sort((a, b) => b[0] - a[0]); // latest opening first
        for (const [s, e] of candidates) {
            try {
                const arr = JSON.parse(cleaned.slice(s, e + 1));
                if (Array.isArray(arr)) {
                    const glosses = arr.filter(v => typeof v === 'string');
                    if (glosses.length > 0) return glosses;
                }
            } catch { /* try next */ }
        }
        // Fallback: quoted CJK strings in order
        const quoted = cleaned.match(/"([^"]*[\u4e00-\u9fff][^"]*)"/g) || [];
        return quoted.map(q => q.slice(1, -1)).slice(0, expectedLen || quoted.length);
    }

    /**
     * 清洗释义：仅保留中文为主体的短词 (Sanitize gloss)
     */
    sanitizeGloss(gloss) {
        if (!gloss || typeof gloss !== 'string') return '';
        let text = gloss.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
        // Remove POS prefixes like "n." / "adj." etc.
        text = text.replace(/^[a-zA-Z]+\.\s*/, '');
        // Cut at any English/punctuation tail, keep the leading Chinese part
        const cjkMatch = text.match(/[\u4e00-\u9fff／/、；;，,·]+/u);
        if (!cjkMatch) return '';
        text = cjkMatch[0].replace(/[／/、；;，,·]+$/, '');
        if (!text || text.length > 12) return '';
        return text;
    }

    cacheKey(word, context) {
        return `${(word || '').toLowerCase()}::${this.truncateContext(context)}`;
    }

    clearCache() {
        this.cache.clear();
    }
}
