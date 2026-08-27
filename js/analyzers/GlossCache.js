/**
 * GlossCache Module
 * LLM 上下文释义持久化缓存 (Persistent cache for LLM context glosses)
 *
 * 缓存 key = "单词::所在句子（截断后）"，与 LLMSenseSelector.cacheKey 完全一致：
 * 一个句子里的多个单词各自生成独立 key，互不干扰。
 *
 * 特性 (Features):
 * - 内存 Map + storageHelper(localStorage) 持久化，刷新页面不丢失
 * - 写入防抖，避免高频 set 触发频繁序列化
 * - 容量上限（默认 5000 条），超出时淘汰最旧条目
 * - 导出/导入（union 合并，冲突保留时间戳更新的）供 Google Drive 同步使用
 * - onDirty 回调：出现新缓存条目时通知外部（如同步调度器）
 */
import { storageHelper } from '../StorageHelper.js';

export class GlossCache {
    static STORAGE_KEY = 'wordDiscovererGlossCache';
    static MAX_ENTRIES = 5000;

    constructor() {
        /** @type {Map<string, {gloss: string, t: number}>} */
        this.entries = new Map();
        this.loaded = false;
        this._persistTimer = null;
        this._dirtySince = null;

        /**
         * 出现新条目时触发（由同步调度方设置，如 VocabularyManager 的防抖同步）
         * (Fired when new entries appear; set by sync scheduler)
         * @type {function(): void|null}
         */
        this.onDirty = null;

        this._load();
    }

    /**
     * 从 storageHelper 加载缓存 (Load persisted cache)
     * @private
     */
    async _load() {
        try {
            const saved = await storageHelper.getItem(GlossCache.STORAGE_KEY);
            if (saved && typeof saved === 'object' && Array.isArray(saved.entries)) {
                for (const [key, value] of saved.entries) {
                    if (typeof key === 'string' && value && typeof value.gloss === 'string') {
                        this.entries.set(key, { gloss: value.gloss, t: Number(value.t) || 0 });
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ GlossCache load failed:', error);
        } finally {
            this.loaded = true;
        }
    }

    /**
     * 等待初始加载完成 (Wait for initial load)
     * @returns {Promise<void>}
     */
    async waitForLoad() {
        if (this.loaded) return;
        await new Promise((resolve) => {
            const check = () => (this.loaded ? resolve() : setTimeout(check, 20));
            check();
        });
    }

    /**
     * 查询缓存 (Get cached gloss)
     * @param {string} key - "word::context" 形式的 key
     * @returns {string|undefined} 中文释义，未命中返回 undefined
     */
    get(key) {
        const entry = this.entries.get(key);
        return entry ? entry.gloss : undefined;
    }

    /**
     * 是否命中 (Whether key exists)
     */
    has(key) {
        return this.entries.has(key);
    }

    /**
     * 写入缓存条目 (Set a cache entry)
     * 同一 key 重复写入时仅当内容变化才更新时间戳并视为脏。
     * @param {string} key
     * @param {string} gloss
     */
    set(key, gloss) {
        if (!key || !gloss) return;
        const existing = this.entries.get(key);
        const isNew = !existing || existing.gloss !== gloss;
        if (!isNew) return;

        // LRU 式重排：命中过的条目移到尾部，淘汰时从头删
        if (existing) this.entries.delete(key);
        this.entries.set(key, { gloss, t: Date.now() });
        this._evictIfNeeded();
        this._schedulePersist();
        if (!this._dirtySince) this._dirtySince = Date.now();
        if (typeof this.onDirty === 'function') {
            try { this.onDirty(); } catch { /* ignore listener errors */ }
        }
    }

    /**
     * 超出容量上限时淘汰最旧条目 (Evict oldest entries beyond capacity)
     * @private
     */
    _evictIfNeeded() {
        while (this.entries.size > GlossCache.MAX_ENTRIES) {
            const oldestKey = this.entries.keys().next().value;
            this.entries.delete(oldestKey);
        }
    }

    /**
     * 防抖持久化到 localStorage (Debounced persist)
     * @private
     */
    _schedulePersist() {
        if (this._persistTimer) return;
        this._persistTimer = setTimeout(() => {
            this._persistTimer = null;
            this.persist();
        }, 2000);
    }

    /**
     * 立即持久化 (Persist immediately)
     */
    async persist() {
        try {
            await storageHelper.setItem(GlossCache.STORAGE_KEY, {
                version: '1.0',
                entries: Array.from(this.entries.entries())
            });
            this._dirtySince = null;
        } catch (error) {
            console.warn('⚠️ GlossCache persist failed:', error);
        }
    }

    /**
     * 导出为可同步的 JSON 对象 (Export for syncing)
     */
    exportData() {
        return {
            version: '1.0',
            updatedAt: new Date().toISOString(),
            entries: Array.from(this.entries.entries())
        };
    }

    /**
     * 导入（union 合并）远程数据 (Import & union-merge remote data)
     * 冲突条目保留时间戳更新的；返回是否发生了变化。
     * @param {Object} data
     * @returns {boolean} 是否有本地数据被更新
     */
    importData(data) {
        if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) return false;
        let changed = false;
        for (const [key, value] of data.entries) {
            if (typeof key !== 'string' || !value || typeof value.gloss !== 'string') continue;
            const incoming = { gloss: value.gloss, t: Number(value.t) || 0 };
            const local = this.entries.get(key);
            if (!local) {
                this.entries.set(key, incoming);
                changed = true;
            } else if (incoming.t > local.t && incoming.gloss !== local.gloss) {
                this.entries.set(key, incoming);
                changed = true;
            }
        }
        if (changed) {
            this._evictIfNeeded();
            this.persist();
        }
        return changed;
    }

    /**
     * 条目数量 (Entry count)
     */
    get size() {
        return this.entries.size;
    }

    /**
     * 清空缓存 (Clear cache)
     */
    clear() {
        this.entries.clear();
        storageHelper.removeItem(GlossCache.STORAGE_KEY);
    }
}

// 模块级单例：LLMSenseSelector 与 VocabularyManager（同步调度）共享同一份缓存
// (Module-level singleton shared by LLMSenseSelector and the sync scheduler)
export const glossCache = new GlossCache();
