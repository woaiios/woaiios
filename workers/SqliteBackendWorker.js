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
 * Messages (request/response via WorkerBridge protocol: {id,type,payload}):
 *  - init           { metadataUrl }                 -> { totalChunks, totalWords, totalBytes }
 *  - loadChunk      { chunkNumber, baseUrl }        -> { chunkNumber, wordCount, alreadyLoaded }
 *  - queryWord      { word }                        -> { word, data }     (data: row | null)
 *  - queryWordsBatch{ words:[...] }                 -> [{ word, data }]
 *  - findLemma      { form }                        -> { form, lemma, data }
 *                                                   (data: lemma 行 | null；基于 exchange 反向索引)
 *
 * 每个分片在 loadChunk 时，从 words.exchange 列反向建一张 inflections(变形词->原型)
 * 索引表，用于把 stood / dotted / photographs 这类变形词精确解析回原型（不使用启发式猜测）。
 */

import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import pako from 'pako';

let SQL = null;
let metadata = null;
const dbMap = new Map(); // chunkNumber -> { db, stmt, count }
let totalBytes = 0;
let loadedBytes = 0;

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
        // 服务器可能已自动解压（Content-Encoding: gzip）
        return buf;
    }
}

async function handleInit({ metadataUrl }) {
    const res = await fetch(metadataUrl);
    if (!res.ok) throw new Error(`metadata ${res.status}`);
    metadata = await res.json();
    totalBytes = metadata.chunks.reduce((s, c) => s + (c.sizeBytes || 0), 0);
    loadedBytes = 0;
    return {
        totalChunks: metadata.totalChunks,
        totalWords: metadata.totalWords,
        totalBytes
    };
}

async function handleLoadChunk({ chunkNumber, baseUrl }) {
    if (!metadata) throw new Error('worker not initialized');

    const existing = dbMap.get(chunkNumber);
    if (existing) {
        return { chunkNumber, alreadyLoaded: true, wordCount: existing.count };
    }

    const info = metadata.chunks.find(c => c.chunkNumber === chunkNumber);
    if (!info) throw new Error(`chunk ${chunkNumber} not in metadata`);

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
    loadedBytes += info.sizeBytes || 0;

    return {
        chunkNumber,
        wordCount: info.wordCount,
        alreadyLoaded: false,
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
        for (const pair of ex.split('/')) {
            const idx = pair.indexOf(':');
            if (idx < 0) continue;
            const val = pair.slice(idx + 1).trim().toLowerCase();
            if (!val || val === row.word.toLowerCase()) continue; // 跳过空值/与原词相同
            ins.run([val, row.word]);
        }
    }
    sel.reset();
    sel.free();
    ins.free();
}

/**
 * 在所有已加载分片里按词频顺序查找（先命中高频 chunk）
 */
function queryOne(lower) {
    if (!metadata) return null;
    for (let n = 1; n <= metadata.totalChunks; n++) {
        const entry = dbMap.get(n);
        if (!entry) continue;
        entry.stmt.bind([lower]);
        let row = null;
        if (entry.stmt.step()) row = entry.stmt.getAsObject();
        entry.stmt.reset();
        if (row) return row;
    }
    return null;
}

/**
 * 反查变形词的原型：在 inflections 表中精确匹配，命中后顺带返回原型词行。
 */
function findLemma(form) {
    const f = String(form || '').toLowerCase();
    if (!metadata || !f) return { form: f, lemma: null, data: null };
    for (let n = 1; n <= metadata.totalChunks; n++) {
        const entry = dbMap.get(n);
        if (!entry) continue;
        const st = entry.db.prepare(`SELECT lemma FROM inflections WHERE form = ? LIMIT 1`);
        st.bind([f]);
        let lemma = null;
        if (st.step()) lemma = st.getAsObject().lemma;
        st.free();
        if (lemma) {
            return { form: f, lemma, data: queryOne(lemma.toLowerCase()) };
        }
    }
    return { form: f, lemma: null, data: null };
}

function handleQueryWord({ word }) {
    const data = queryOne(String(word).toLowerCase());
    return { word, data };
}

function handleQueryWordsBatch({ words }) {
    return words.map(w => ({ word: w, data: queryOne(String(w).toLowerCase()) }));
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
                result = handleQueryWord(payload);
                break;
            case 'queryWordsBatch':
                result = handleQueryWordsBatch(payload);
                break;
            case 'findLemma':
                result = findLemma(payload.form);
                break;
            default:
                throw new Error(`unknown type: ${type}`);
        }
        self.postMessage({ id, type: 'success', result });
    } catch (error) {
        self.postMessage({ id, type: 'error', error: { message: error.message, stack: error.stack } });
    }
};

console.log('[SqliteBackendWorker] ready');
