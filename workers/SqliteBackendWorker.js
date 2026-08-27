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
            default:
                throw new Error(`unknown type: ${type}`);
        }
        self.postMessage({ id, type: 'success', result });
    } catch (error) {
        self.postMessage({ id, type: 'error', error: { message: error.message, stack: error.stack } });
    }
};

console.log('[SqliteBackendWorker] ready');
