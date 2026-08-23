/**
 * LLMSenseSelector Module
 * 借助本地大模型（LM Studio, OpenAI 兼容 API）结合上下文为单词挑选最贴切的中文释义
 *
 * 工作方式 (How it works):
 * - 将多个待消歧的词条打包成批，一次请求完成 (Batch multiple words into one request)
 * - 要求模型只返回严格 JSON: {"1": "银行", ...} (Strict JSON output)
 * - 内置缓存与熔断：失败后自动降级到本地启发式结果 (Cache + circuit breaker fallback)
 */
export class LLMSenseSelector {
    static DEFAULT_ENDPOINT = 'https://pc-20260820eaeq.tailfbac23.ts.net:8443/v1/chat/completions';
    // Vite dev server proxy path (see vite.config.js) used as CORS-free fallback
    static PROXY_ENDPOINT = '/lm-studio/v1/chat/completions';
    static DEFAULT_MODEL = 'qwen3.5-35b-a3b-uncensored-hauhaucs-aggressive';

    constructor(options = {}) {
        this.endpoint = options.endpoint || LLMSenseSelector.DEFAULT_ENDPOINT;
        this.model = options.model || LLMSenseSelector.DEFAULT_MODEL;
        this.timeoutMs = options.timeoutMs ?? 150000;
        // Small batches keep reasoning-mode models (qwen3.x) compliant — large
        // prompts trigger endless prose "thinking" that truncates before JSON
        this.maxBatchSize = options.maxBatchSize ?? 2;
        this.temperature = options.temperature ?? 0.1;
        this.maxContextChars = options.maxContextChars ?? 160;

        this.cache = new Map();          // key: word::context -> chinese gloss
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
    async selectSenses(items) {
        const results = new Map();
        if (!items?.length || this.disabled) return results;

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

        // 3. Request chunks with limited parallelism (LM Studio queues internally;
        //    wall-clock ≈ slowest chunk instead of the sum)
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
                    await this.requestChunk(group, results, deduped);
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
    async requestChunk(chunk, results, deduped) {
        const prompt = this.buildPrompt(chunk);
        let glosses = this.parseSenseArray(await this.chat(prompt), chunk.length);
        let matched = this.collectGlosses(glosses, chunk, results, deduped);

        // One nudge retry when the model rambled instead of answering
        if (matched === 0) {
            glosses = this.parseSenseArray(
                await this.chat(prompt + '\n/no_think\nAnswer with ONLY the JSON array now.'),
                chunk.length
            );
            matched = this.collectGlosses(glosses, chunk, results, deduped);
        }
        if (matched === 0) {
            throw new Error('Model returned no usable senses');
        }
    }

    /**
     * 按位置回填释义并计数 (Assign positional glosses; return match count)
     */
    collectGlosses(glosses, chunk, results, deduped) {
        let matched = 0;
        chunk.forEach((item, idx) => {
            const clean = this.sanitizeGloss(glosses[idx]);
            if (!clean) return;
            matched += 1;

            const key = this.cacheKey(item.word, item.context);
            this.cache.set(key, clean);
            for (const dup of deduped.get(key)) {
                results.set(dup.id, clean);
            }
        });
        return matched;
    }

    /**
     * 构造消歧提示词 (Build disambiguation prompt)
     * 输出协议：与词条顺序一致的 JSON 字符串数组（位置式，无编号，防错位）
     */
    buildPrompt(chunk) {
        const lines = chunk.map((item) => {
            const context = this.truncateContext(item.context);
            const senses = (item.dictionarySenses || '无词典释义').replace(/\s+/g, ' ').slice(0, 300);
            return `- "${item.word}" | sentence: ${context} | senses: ${senses}`;
        });

        return [
            'You are a professional English-Chinese lexicographer.',
            'For each entry below, determine what the word means IN ITS SENTENCE and give ONE concise Chinese gloss.',
            '',
            lines.join('\n'),
            '',
            'Rules:',
            '- The gloss must reflect the meaning in THAT sentence, not just the first dictionary sense.',
            '- Very short: 1-6 Chinese characters preferred, 10 max. Chinese only, no pinyin/English/POS.',
            '- Use the natural full Chinese word for the concept (e.g. a "neon sign" context -> 霓虹灯, not the element 氖 or bare transliteration 霓虹).',
            '- Output ONLY a JSON array of glosses in the SAME ORDER as the entries, nothing else.',
            '- Example output format: ["银行", "岸"]'
        ].join('\n');
    }

    truncateContext(context = '') {
        const text = context.trim().replace(/\s+/g, ' ');
        if (text.length <= this.maxContextChars) return text;
        return text.slice(0, this.maxContextChars) + '…';
    }

    /**
     * 调用 OpenAI 兼容接口 (Call OpenAI-compatible chat completions)
     */
    async chat(prompt) {
        const candidates = [this.workingEndpoint, this.endpoint, LLMSenseSelector.PROXY_ENDPOINT]
            .filter(Boolean)
            .filter((value, index, arr) => arr.indexOf(value) === index);

        let lastError = null;
        for (const endpoint of candidates) {
            try {
                // AbortController is missing on old WebKit (iOS 12) — fall back
                // to a Promise.race timeout so requests still time out cleanly
                const fetchOpts = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: this.temperature,
                        // Reasoning models may think at length before answering —
                        // give them room or the JSON gets truncated
                        max_tokens: 6000,
                        stream: false,
                        // Disable thinking mode for reasoning models (qwen3.x)
                        chat_template_kwargs: { enable_thinking: false }
                    })
                };

                let timeoutReject;
                const timeoutPromise = new Promise((_, rej) => {
                    timeoutReject = rej;
                });
                const timer = setTimeout(() => timeoutReject(new Error('LLM request timed out')), this.timeoutMs);

                if (typeof AbortController !== 'undefined') {
                    const controller = new AbortController();
                    fetchOpts.signal = controller.signal;
                    setTimeout(() => controller.abort(), this.timeoutMs);
                }

                let response;
                try {
                    response = await Promise.race([
                        fetch(endpoint, fetchOpts),
                        timeoutPromise
                    ]);
                } finally {
                    clearTimeout(timer);
                }
                if (!response.ok) {
                    throw new Error(`LM Studio HTTP ${response.status} from ${endpoint}`);
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
     * 从模型输出中提取释义数组 (Extract positional gloss array)
     * 期望形如 ["银行", "岸"]；容忍思考散文、代码围栏、前后杂文本。
     */
    parseSenseArray(text, expectedLen) {
        if (!text) return [];
        const cleaned = String(text)
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
