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
        this.timeoutMs = options.timeoutMs ?? 90000;
        this.maxBatchSize = options.maxBatchSize ?? 10;
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

        // 3. Request in chunks, sequentially (local LLM handles one at a time best)
        const entries = [...deduped.values()];
        for (let i = 0; i < entries.length; i += this.maxBatchSize) {
            if (this.disabled) break;
            const chunk = entries.slice(i, i + this.maxBatchSize).map(list => list[0]);
            try {
                await this.requestChunk(chunk, results, deduped);
                this.consecutiveFailures = 0;
            } catch (error) {
                this.consecutiveFailures += 1;
                console.warn('⚠️ LLM sense selection failed:', error.message);
                if (this.consecutiveFailures >= 2) {
                    this.disabled = true;
                    console.warn('⚠️ LLM sense selector disabled for this session (service unavailable?)');
                }
            }
        }
        return results;
    }

    /**
     * 发送一批词条给模型并解析结果 (Send one chunk and parse)
     */
    async requestChunk(chunk, results, deduped) {
        const content = await this.chat(this.buildPrompt(chunk));
        const parsed = this.parseSenseMap(content);

        let matched = 0;
        for (const item of chunk) {
            const gloss = parsed[String(item.id)] ?? parsed[item.id];
            const clean = this.sanitizeGloss(gloss);
            if (!clean) continue;
            matched += 1;

            const key = this.cacheKey(item.word, item.context);
            this.cache.set(key, clean);
            for (const dup of deduped.get(key)) {
                results.set(dup.id, clean);
            }
        }
        if (matched === 0) {
            throw new Error('Model returned no usable senses');
        }
    }

    /**
     * 构造消歧提示词 (Build disambiguation prompt)
     */
    buildPrompt(chunk) {
        const lines = chunk.map((item, idx) => {
            const n = idx + 1;
            const context = this.truncateContext(item.context);
            const senses = (item.dictionarySenses || '无词典释义').replace(/\s+/g, ' ').slice(0, 300);
            return `Entry ${n}: word "${item.word}"\nSentence: ${context}\nDictionary senses: ${senses}`;
        });

        return [
            'You are a professional English-Chinese lexicographer.',
            'For each entry below, determine the meaning the English word carries IN THE GIVEN SENTENCE,',
            'then choose or write the single most fitting concise Chinese gloss.',
            '',
            lines.join('\n\n'),
            '',
            'Rules:',
            '- The gloss must match the meaning in that sentence, not just the first dictionary sense.',
            '- Keep it very short: 1-6 Chinese characters preferred, at most 10.',
            '- No pinyin, no English, no explanations, no part-of-speech tags.',
            '- Respond with ONLY a JSON object mapping entry numbers to glosses, like {"1": "银行", "2": "岸"}.'
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
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), this.timeoutMs);
                let response;
                try {
                    response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: this.model,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: this.temperature,
                            max_tokens: 1000,
                            stream: false,
                            // Disable thinking mode for reasoning models (qwen3.x) so
                            // tokens are spent on the actual answer, not hidden reasoning
                            chat_template_kwargs: { enable_thinking: false }
                        }),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timer);
                }
                if (!response.ok) {
                    throw new Error(`LM Studio HTTP ${response.status} from ${endpoint}`);
                }
                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('Empty completion');
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
     * 从模型输出中提取 {序号: 释义} 映射 (Robust JSON extraction)
     */
    parseSenseMap(text) {
        if (!text) return {};
        // Strip qwen-style thinking blocks and markdown fences
        let cleaned = String(text)
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/```(?:json)?/gi, '');

        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return {};

        try {
            const obj = JSON.parse(cleaned.slice(start, end + 1));
            const map = {};
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'string') map[key] = value;
            }
            return map;
        } catch {
            return {};
        }
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
