/**
 * DirectDataStorage Module
 * 唯一的数据访问层。底层从「预打包的 SQLite 分片 (.db.gz)」加载字典，
 * 通过 Web Worker + sql.js 直接做 SQL 查询（按 word_lower 索引，O(log n)）。
 *
 * 与旧 IndexedDB 方案相比：
 *  - 分片在构建期已打包好，运行时只需下载 → 解压 → 打开 SQLite，
 *    不再有 77 万条逐行写入 IndexedDB 的 CPU 高峰（手机发烫的根因）。
 *  - 数据驻留在 WASM 堆而非 JS 堆，且可随分片按需加载 / 卸载。
 *
 * 对外契约（app.js / DatabaseProgress 依赖）：
 *  - initialize() / setProgressCallback(cb)
 *  - queryWord(word) / queryWordsBatch(words)
 *  - getWordDifficulty(word, level) / getCacheStats() / parseExchange(exchange)
 *  - _wordDatabase.progressiveLoader 提供 on('chunkLoaded') / on('complete')
 */

import { WorkerBridge } from '../WorkerBridge.js';
import SqliteBackendWorker from '../../workers/SqliteBackendWorker.js?worker';
import { CacheManager } from './CacheManager.js';
import { WordQueryService } from './WordQueryService.js';

export class DirectDataStorage {
    constructor() {
        // 内存级热词缓存（查询结果，避免重复 Worker 往返）
        this.cache = new CacheManager(10000);

        // SQLite 后端 Worker（加载分片 + 查询共用同一实例）
        this.workerBridge = new WorkerBridge(SqliteBackendWorker);

        // 查询服务（包装缓存 + Worker 适配器）
        const sqlAdapter = {
            queryWord: (word) => this._queryWord(word),
            queryWordsBatch: (words) => this._queryWordsBatch(words)
        };
        this.queryService = new WordQueryService(sqlAdapter, this.cache);

        // 兼容 DatabaseProgress：把自身暴露为 progressiveLoader
        this._wordDatabase = { progressiveLoader: this };

        // 状态
        this.isInitialized = false;
        this.metadata = null;
        this.loadedChunks = new Set();
        this.progressCallback = null;
        this._listeners = { progress: [], chunkLoaded: [], complete: [], pinnedComplete: [] };
    }

    /* ============ 事件（供 DatabaseProgress 使用） ============ */

    on(event, callback) {
        if (this._listeners[event]) this._listeners[event].push(callback);
    }

    _emit(event, data) {
        (this._listeners[event] || []).forEach(cb => cb(data));
    }

    /**
     * 设置进度回调
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    _reportProgress(data) {
        if (this.progressCallback) this.progressCallback(data);
        this._emit('progress', data);
    }

    /* ============ 初始化 ============ */

    async initialize() {
        try {
            await this.workerBridge.initialize();

            // worker 阶段进度（下载/解压/连接数据库/建索引）→ 合并进统一进度回调。
            // 百分比按「已完成分片 + 当前分片内阶段权重」计算，避免条卡在整片之间不动。
            const STAGE_FRACTION = { download: 0.25, decompress: 0.5, open: 0.75, index: 0.95 };
            this.workerBridge.onNotification(({ type, payload }) => {
                if (type !== 'chunkProgress' || !payload) return;
                const total = this.metadata ? this.metadata.totalChunks : payload.totalChunks || 0;
                const fraction = STAGE_FRACTION[payload.stage] ?? 1;
                const percentage = total > 0
                    ? ((this.loadedChunks.size + (payload.chunkNumber > 0 ? fraction : 0)) / total) * 100
                    : 0;
                this._reportProgress({
                    loaded: this.loadedChunks.size,
                    total,
                    percentage,
                    stage: payload.stage,
                    chunkNumber: payload.chunkNumber,
                    bytes: payload.bytes || 0,
                    message: `chunk ${payload.chunkNumber}/${total}`
                });
            });

            const metadataUrl = `${import.meta.env.BASE_URL}db-chunks/metadata.json`;
            const initResult = await this.workerBridge.sendMessage('init', { metadataUrl });
            this.metadata = initResult;
            this.pinnedChunks = initResult.pinnedChunks || 2;
            const baseUrl = `${import.meta.env.BASE_URL}db-chunks/`;

            // 先加载第1块（高频词）让应用尽快可用
            await this._loadChunk(1, baseUrl);

            this.isInitialized = true;

            // 后台继续加载固定分片（chunk 2 ~ pinnedChunks），其余按需加载
            this._loadRemainingInBackground(2, baseUrl);
            return true;
        } catch (error) {
            console.error('DirectDataStorage init failed:', error);
            this.isInitialized = true;
            return false;
        }
    }

    async _loadChunk(chunkNumber, baseUrl) {
        const result = await this.workerBridge.sendMessage('loadChunk', { chunkNumber, baseUrl });
        if (result.alreadyLoaded) return result;

        this.loadedChunks.add(chunkNumber);
        const total = this.metadata.totalChunks;
        const percentage = this.metadata.totalBytes
            ? (this.loadedChunks.size / total) * 100
            : 0;

        this._reportProgress({
            loaded: this.loadedChunks.size,
            total,
            percentage,
            message: `Loading chunk ${chunkNumber}/${total}`,
            fromCache: result.fromCache || false
        });

        this._emit('chunkLoaded', {
            chunkNumber,
            loaded: this.loadedChunks.size,
            total,
            percentage,
            wordCount: result.wordCount,
            fromCache: result.fromCache || false
        });

        if (this.loadedChunks.size >= total) {
            this._emit('complete', { totalChunks: total, totalWords: this.metadata.totalWords });
        }
        return result;
    }

    async _loadRemainingInBackground(startFrom, baseUrl) {
        // 只加载固定分片（pinnedChunks），其余由 Worker 按需加载
        const endAt = this.pinnedChunks || 2;
        for (let n = startFrom; n <= endAt; n++) {
            await this._waitWhileHidden();
            try {
                await this._loadChunk(n, baseUrl);
            } catch (e) {
                console.warn(`后台加载 chunk ${n} 失败:`, e.message);
            }
            await new Promise(r => setTimeout(r, 100));
        }
        console.log(`✅ 固定分片加载完成（${endAt}/${this.metadata.totalChunks}），其余按需加载`);
        // 数据库真正可用（固定分片就绪，任意词可查 + 低频词按需加载兜底）
        this._emit('pinnedComplete', { pinned: endAt, total: this.metadata ? this.metadata.totalChunks : 0 });
    }

    /**
     * 页面不可见时挂起后台加载，避免锁屏/切后台浪费网络与 CPU
     */
    _waitWhileHidden() {
        if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
        return new Promise(resolve => {
            const handler = () => {
                if (!document.hidden) {
                    document.removeEventListener('visibilitychange', handler);
                    resolve();
                }
            };
            document.addEventListener('visibilitychange', handler);
        });
    }

    /* ============ 查询 ============ */

    async _queryWord(word) {
        try {
            const { data } = await this.workerBridge.sendMessage('queryWord', { word });
            return data;
        } catch {
            return null;
        }
    }

    async _queryWordsBatch(words) {
        try {
            return await this.workerBridge.sendMessage('queryWordsBatch', { words });
        } catch {
            return words.map(w => ({ word: w, data: null }));
        }
    }

    async queryWord(word) {
        if (!this.isInitialized) return null;
        return await this.queryService.queryWord(word);
    }

    /**
     * 数据库是否就绪（首批分片已加载，可查询）
     */
    isDatabaseLoaded() {
        return this.isInitialized && this.loadedChunks.size > 0;
    }

    /**
     * 全部分片是否已加载完成（固定分片加载完毕即可查询任意词，按需加载兜底）
     */
    isDatabaseFullyLoaded() {
        const pinned = this.pinnedChunks || 2;
        return this.isInitialized && !!this.metadata && this.loadedChunks.size >= pinned;
    }

    /**
     * 等待固定分片加载完成。查询未命中时 Worker 会按需加载其余分片，
     * 此方法仅用于确保基础查询能力就绪。
     * @param {number} timeout ms
     * @returns {Promise<boolean>} 是否在超时前完成
     */
    whenFullyLoaded(timeout = 30000) {
        return new Promise((resolve) => {
            if (this.isDatabaseFullyLoaded()) return resolve(true);
            const start = Date.now();
            const tick = () => {
                if (this.isDatabaseFullyLoaded()) return resolve(true);
                if (Date.now() - start > timeout) return resolve(false);
                setTimeout(tick, 300);
            };
            tick();
        });
    }

    async queryWordsBatch(words) {
        if (!this.isInitialized) return [];
        return await this.queryService.queryWordsBatch(words);
    }

    /**
     * 按原形（lemma）回退查找。queryWord 命中失败时，交给 Worker 基于
     * exchange 反向索引表 inflections(变形词->原型) 精确解析原型并返回其词行。
     * @param {string} word 变形词（如 stood / dotted / photographs）
     * @returns {Promise<object|null>} 命中返回原型词行数据，否则 null
     */
    async findByLemma(word) {
        if (!this.isInitialized) return null;
        try {
            const { data } = await this.workerBridge.sendMessage('findLemma', { form: word });
            return data || null;
        } catch {
            return null;
        }
    }

    async getWordDifficulty(word, difficultyLevel) {
        return await this.queryService.getWordDifficulty(word, difficultyLevel);
    }

    getCacheStats() {
        return this.cache.getStats();
    }

    parseExchange(exchange) {
        return this.queryService.parseExchange(exchange);
    }

    /**
     * 清理 worker
     */
    close() {
        this.workerBridge.terminate();
        this.cache.clear();
        this.isInitialized = false;
    }
}
