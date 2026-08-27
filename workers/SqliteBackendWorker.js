/**
 * SqliteBackendWorker
 * Web Worker that holds the ECDICT dictionary as a set of prebuilt SQLite
 * databases (one per frequency chunk) and answers SQL lookups via sql.js.
 *
 * Why SQLite (not IndexedDB import):
 *  - Chunks ship pre-packaged as .db.gz; no per-row object materialization,
 *    no 770k-record IndexedDB writes → no CPU/heat spike on first launch.
 *  - Lookups use a B-tree index (word_lower) → O(log n), and the DB lives in
 *    the WASM heap instead of the JS heap.
 *
 * Memory management (LRU chunk cache):
 *  - PINNED_CHUNKS: 前 N 个高频分片常驻内存，不参与淘汰
 *  - MAX_LRU: LRU 缓存容量，存放按需加载的低频分片
 *  - 查询未命中已加载分片时，自动按序加载后续分片（按需加载）
 *  - 超出容量时淘汰最近最少使用的非固定分片
 *
 * Messages (request/response via WorkerBridge protocol: {id,type,payload}):
 *  - init           { metadataUrl }                 -> { totalChunks, totalWords, totalBytes, pinnedChunks, maxLru }
 *  - loadChunk      { chunkNumber, baseUrl }        -> { chunkNumber, wordCount, alreadyLoaded }
 *  - queryWord      { word }                        -> { word, data }     (data: row | null)
 *  - queryWordsBatch{ words:[...] }                 -> [{ word, data }]
 *  - findLemma      { form }                        -> { form, lemma, data }
 *                                                   (data: lemma 行 | null；基于 exchange 反向索引)
 *  - getLoadedChunks                                -> { loaded: number[], pinned: number[] }
 *
 * 每个分片在 loadChunk 时，从 words.exchange 列反向建一张 inflections(变形词->原型)
 * 索引表，用于把 stood / dotted / photographs 这类变形词精确解析回原型（不使用启发式猜测）。
 */

import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import pako from 'pako';

const PINNED_CHUNKS = 2;   // 前2个高频分片（chunk 1、2）常驻内存
const MAX_LRU = 2;         // LRU 缓存容量（额外可加载的分片数）
const MAX_LOADED = PINNED_CHUNKS + MAX_LRU; // 同时在内存中的最大分片数 = 4

let SQL = null;
let metadata = null;
const dbMap = new Map(); // chunkNumber -> { db, stmt, count }
let totalBytes = 0;
let loadedBytes = 0;
let storedBaseUrl = '';    // 保存 baseUrl 供按需加载使用
const lruOrder = [];       // LRU 顺序（最近使用的在末尾）

async function ensureSql() {
    if (!SQL) {
        SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
    }
    return SQL;
}

function gunzip(buf) {
    const u8 = new Uint8Array(buf);
    try {
        return pako.ungzip(u8).buffer;
    } catch {
        return buf;
    }
}

/* ============ LRU 缓存管理 ============ */

function isPinned(chunkNumber) {
    return chunkNumber <= PINNED_CHUNKS;
}

function touchLRU(chunkNumber) {
    const idx = lruOrder.indexOf(chunkNumber);
    if (idx !== -1) lruOrder.splice(idx, 1);
    lruOrder.push(chunkNumber);
}

function evictLRU() {
    const evictable = lruOrder.filter(n => !isPinned(n));
    if (evictable.length === 0) return null;
    const victim = evictable[0];
    const entry = dbMap.get(victim);
    if (entry) {
        entry.stmt.free();
        entry.db.close();
        dbMap.delete(victim);
    }
    lruOrder.splice(lruOrder.indexOf(victim), 1);
    console.log(`[Worker] 🗑️  Evicted chunk ${victim} (LRU)`);
    return victim;
}

function ensureCapacity() {
    if (dbMap.size < MAX_LOADED) return null;
    return evictLRU();
}

/* ============ 按需加载 ============ */

async function ensureChunkLoaded(chunkNumber) {
    if (dbMap.has(chunkNumber)) {
        touchLRU(chunkNumber);
        return true;
    }
    if (!metadata || !storedBaseUrl) return false;
    try {
        await handleLoadChunk({ chunkNumber, baseUrl: storedBaseUrl });
        return true;
    } catch {
        return false;
    }
}

/* ============ 处理函数 ============ */

async function handleInit({ metadataUrl }) {
    const res = await fetch(metadataUrl);
    if (!res.ok) throw new Error(`metadata ${res.status}`);
    metadata = await res.json();
    totalBytes = metadata.chunks.reduce((s, c) => s + (c.sizeBytes || 0), 0);
    loadedBytes = 0;
    // 从 metadataUrl 推导 baseUrl（去掉文件名）
    storedBaseUrl = metadataUrl.replace(/[^/]*$/, '');
    return {
        totalChunks: metadata.totalChunks,
        totalWords: metadata.totalWords,
        totalBytes,
        pinnedChunks: PINNED_CHUNKS,
        maxLru: MAX_LRU
    };
}

async function handleLoadChunk({ chunkNumber, baseUrl }) {
    if (!metadata) throw new Error('worker not initialized');
    if (baseUrl) storedBaseUrl = baseUrl;

    const existing = dbMap.get(chunkNumber);
    if (existing) {
        touchLRU(chunkNumber);
        return { chunkNumber, alreadyLoaded: true, wordCount: existing.count };
    }

    const info = metadata.chunks.find(c => c.chunkNumber === chunkNumber);
    if (!info) throw new Error(`chunk ${chunkNumber} not in metadata`);

    // 超出容量时淘汰 LRU 分片
    const evicted = ensureCapacity();

    const res = await fetch(`${baseUrl}${info.filename}`);
    if (!res.ok) throw new Error(`chunk ${chunkNumber} fetch ${res.status}`);

    const bytes = gunzip(await res.arrayBuffer());
    const db = new SQL.Database(new Uint8Array(bytes));
    const stmt = db.prepare(
        `SELECT word, phonetic, definition, translation, pos, collins, oxford,
                tag, bnc, frq, exchange, detail, audio
         FROM words WHERE word_lower = ?`
    );

    buildInflections(db);

    dbMap.set(chunkNumber, { db, stmt, count: info.wordCount });
    touchLRU(chunkNumber);
    loadedBytes += info.sizeBytes || 0;

    return {
        chunkNumber,
        wordCount: info.wordCount,
        alreadyLoaded: false,
        evicted,
        progress: { loadedBytes, totalBytes, percentage: totalBytes ? (loadedBytes / totalBytes) * 100 : 0 }
    };
}

/**
 * 从 words.exchange 反向建 inflections(变形词 -> 原型) 索引表。
 * ECDICT exchange 形如 "p:stands/3:stands/d:stood/i:stood/ing:standing"，
 * 其中 p/d/i/3/r/t/s 为各变形、value 为变形词、word 即原型。
 * 建表只在此分片打开时做一次，之后 findLemma 走索引 O(log n) 查询。
 */
function buildInflections(db) {
    db.run(`CREATE TABLE IF NOT EXISTS inflections(form TEXT, lemma TEXT)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inflections_form ON inflections(form)`);

    const ins = db.prepare(`INSERT INTO inflections(form, lemma) VALUES (?, ?)`);
    const sel = db.prepare(`SELECT word, exchange FROM words`);
    while (sel.step()) {
        const row = sel.getAsObject();
        const ex = row.exchange;
        if (!ex) continue;
        const headLower = row.word.toLowerCase();
        for (const pair of ex.split('/')) {
            const idx = pair.indexOf(':');
            if (idx < 0) continue;
            const type = pair.slice(0, idx);          // p/d/i/3/r/t/s/0/1
            const val = pair.slice(idx + 1).trim().toLowerCase();
            if (!val || val === headLower) continue;   // 跳过空值/与原词相同
            if (type === '0') {
                // 0: 原形标记 —— 本行词(row.word)是变形，val 才是原型
                // 例如 carpeted 行 exchange="0:carpet/1:v" => inflections(carpeted -> carpet)
                ins.run([headLower, val]);
            } else if (type.length === 1 && 'pdi3rts'.includes(type)) {
                // 普通变形类型 —— val 是变形，row.word 是原型
                // 例如 shelf 行 exchange="s:shelves" => inflections(shelves -> shelf)
                ins.run([val, headLower]);
            }
            // 1: 是词性标记(如 v/n)，不是词形，忽略
        }
    }
    sel.reset();
    sel.free();
    ins.free();
}

/**
 * 在已加载分片里按词频顺序查找；未命中时按需加载后续分片直到找到或遍历完毕。
 * 高频词在 chunk 1（常驻），绝大多数查询 1 次命中即返回。
 */
async function queryOne(lower) {
    if (!metadata) return null;

    // 第一轮：在已加载分片中查找
    for (let n = 1; n <= metadata.totalChunks; n++) {
        const entry = dbMap.get(n);
        if (!entry) continue;
        entry.stmt.bind([lower]);
        let row = null;
        if (entry.stmt.step()) row = entry.stmt.getAsObject();
        entry.stmt.reset();
        if (row) {
            touchLRU(n);
            return row;
        }
    }

    // 第二轮：未命中，按需加载未加载的分片继续查找
    for (let n = 1; n <= metadata.totalChunks; n++) {
        if (dbMap.has(n)) continue;
        if (!(await ensureChunkLoaded(n))) continue;
        const entry = dbMap.get(n);
        if (!entry) continue;
        entry.stmt.bind([lower]);
        let row = null;
        if (entry.stmt.step()) row = entry.stmt.getAsObject();
        entry.stmt.reset();
        if (row) {
            touchLRU(n);
            return row;
        }
    }
    return null;
}

/**
 * 反查变形词的原型：在 inflections 表中精确匹配，命中后顺带返回原型词行。
 * 支持按需加载：已加载分片未命中时，自动加载后续分片。
 */
async function findLemma(form) {
    const f = String(form || '').toLowerCase();
    if (!metadata || !f) return { form: f, lemma: null, data: null };

    // 第一轮：在已加载分片中查找
    for (let n = 1; n <= metadata.totalChunks; n++) {
        const entry = dbMap.get(n);
        if (!entry) continue;
        const st = entry.db.prepare(`SELECT lemma FROM inflections WHERE form = ? LIMIT 1`);
        st.bind([f]);
        let lemma = null;
        if (st.step()) lemma = st.getAsObject().lemma;
        st.free();
        if (lemma) {
            touchLRU(n);
            return { form: f, lemma, data: await queryOne(lemma.toLowerCase()) };
        }
    }

    // 第二轮：按需加载未加载的分片
    for (let n = 1; n <= metadata.totalChunks; n++) {
        if (dbMap.has(n)) continue;
        if (!(await ensureChunkLoaded(n))) continue;
        const entry = dbMap.get(n);
        if (!entry) continue;
        const st = entry.db.prepare(`SELECT lemma FROM inflections WHERE form = ? LIMIT 1`);
        st.bind([f]);
        let lemma = null;
        if (st.step()) lemma = st.getAsObject().lemma;
        st.free();
        if (lemma) {
            touchLRU(n);
            return { form: f, lemma, data: await queryOne(lemma.toLowerCase()) };
        }
    }
    return { form: f, lemma: null, data: null };
}

async function handleQueryWord({ word }) {
    const data = await queryOne(String(word).toLowerCase());
    return { word, data };
}

/**
 * 批量查询优化：按 chunk 分组 + IN 批量查询。
 * 原实现：逐词串行 queryOne → N 词 × M chunk 次 SQLite 调用
 * 新实现：逐 chunk IN 批量 → M chunk 次 SQLite 调用（每词命中即移出集合）
 */
const BATCH_SIZE = 200; // IN 子句每批参数上限（SQLite 默认 SQLITE_MAX_VARIABLE_NUMBER=999，保守取 200）

async function handleQueryWordsBatch({ words }) {
    if (!metadata || !words || words.length === 0) return [];

    const resultMap = new Map(); // lower -> { word, data }
    const unresolved = new Map(); // lower -> originalWord

    for (const w of words) {
        const lower = String(w).toLowerCase();
        unresolved.set(lower, w);
    }

    // 第一轮：在已加载分片中按 chunk 批量查询
    for (let n = 1; n <= metadata.totalChunks && unresolved.size > 0; n++) {
        const entry = dbMap.get(n);
        if (!entry) continue;
        const found = await batchQueryInChunk(entry, n, unresolved, resultMap);
        if (found) touchLRU(n);
    }

    // 第二轮：未命中的词，按需加载后续分片继续查
    for (let n = 1; n <= metadata.totalChunks && unresolved.size > 0; n++) {
        if (dbMap.has(n)) continue;
        if (!(await ensureChunkLoaded(n))) continue;
        const entry = dbMap.get(n);
        if (!entry) continue;
        const found = await batchQueryInChunk(entry, n, unresolved, resultMap);
        if (found) touchLRU(n);
    }

    // 组装结果（保持原始顺序）
    return words.map(w => {
        const lower = String(w).toLowerCase();
        const found = resultMap.get(lower);
        return { word: w, data: found ? found.data : null };
    });
}

/**
 * 在单个 chunk 中用 IN 子句批量查询未解决的词。
 * 命中的词从 unresolved 中移除并写入 resultMap。
 * @returns {boolean} 是否有词被命中
 */
async function batchQueryInChunk(entry, chunkNumber, unresolved, resultMap) {
    const keys = [...unresolved.keys()];
    if (keys.length === 0) return false;

    let found = false;

    // 分批查询（SQLite 参数上限）
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
        const batch = keys.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;

        const placeholders = batch.map(() => '?').join(',');
        const sql = `SELECT word, phonetic, definition, translation, pos, collins, oxford,
                            tag, bnc, frq, exchange, detail, audio
                     FROM words WHERE word_lower IN (${placeholders})`;
        const stmt = entry.db.prepare(sql);
        stmt.bind(batch);

        while (stmt.step()) {
            const row = stmt.getAsObject();
            const wordLower = (row.word || '').toLowerCase();
            const originalWord = unresolved.get(wordLower);
            if (originalWord) {
                resultMap.set(wordLower, { word: originalWord, data: row });
                unresolved.delete(wordLower);
                found = true;
            }
        }
        stmt.free();
    }

    return found;
}

self.onmessage = async (event) => {
    const { id, type, payload } = event.data;
    try {
        let result;
        switch (type) {
            case 'init':
                await ensureSql();
                result = await handleInit(payload);
                break;
            case 'loadChunk':
                result = await handleLoadChunk(payload);
                break;
            case 'queryWord':
                result = await handleQueryWord(payload);
                break;
            case 'queryWordsBatch':
                result = await handleQueryWordsBatch(payload);
                break;
            case 'findLemma':
                result = await findLemma(payload.form);
                break;
            case 'getLoadedChunks':
                result = {
                    loaded: [...dbMap.keys()].sort((a, b) => a - b),
                    pinned: Array.from({ length: PINNED_CHUNKS }, (_, i) => i + 1),
                    lruOrder: [...lruOrder],
                    maxLoaded: MAX_LOADED
                };
                break;
            default:
                throw new Error(`unknown type: ${type}`);
        }
        self.postMessage({ id, type: 'success', result });
    } catch (error) {
        self.postMessage({ id, type: 'error', error: { message: error.message, stack: error.stack } });
    }
};

console.log('[SqliteBackendWorker] ready (LRU: pinned=' + PINNED_CHUNKS + ', lru=' + MAX_LRU + ')');
