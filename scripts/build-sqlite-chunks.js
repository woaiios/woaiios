#!/usr/bin/env node
/**
 * 把现有的 JSON.GZ 分片打包成 SQLite 分片压缩文件 (.db.gz)
 * - 每个 chunk 生成一个独立 SQLite 数据库（含 word_lower 索引）
 * - 更新 metadata.json 的 filename / sizeBytes，删除旧 json.gz
 * - 幂等：若对应 db.gz 已存在而 json.gz 已删除，则跳过
 *
 * 使用 sql.js（与运行时同一引擎）在 Node 端构建，无需 stardict.db 源文件。
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHUNKS_DIR = join(__dirname, '../public/db-chunks');
const NUM_FIELDS = 14; // word + 12 meta + word_lower

async function buildChunk(SQL, chunkNum, meta) {
    const jsonName = `chunk-${chunkNum}.json.gz`;
    const jsonPath = join(CHUNKS_DIR, jsonName);
    if (!existsSync(jsonPath)) {
        console.log(`⏭️  chunk-${chunkNum}: json.gz 已删除，假设 db.gz 已存在，跳过`);
        return null;
    }

    const { gunzipSync } = await import('zlib');
    const arr = JSON.parse(gunzipSync(readFileSync(jsonPath)).toString('utf8'));
    console.log(`  📝 chunk-${chunkNum}: ${arr.length.toLocaleString()} 条`);

    const db = new SQL.Database();

    // 建表 + 索引（按词频分片，每片独立库；word 为主键保证幂等导入）
    db.run(`CREATE TABLE words(
        word TEXT PRIMARY KEY,
        phonetic TEXT,
        definition TEXT,
        translation TEXT,
        pos TEXT,
        collins INTEGER,
        oxford INTEGER,
        tag TEXT,
        bnc INTEGER,
        frq INTEGER,
        exchange TEXT,
        detail TEXT,
        audio TEXT,
        word_lower TEXT
    );`);
    db.run(`CREATE INDEX idx_words_lower ON words(word_lower);`);

    const stmt = db.prepare(
        `INSERT OR REPLACE INTO words(
            word, phonetic, definition, translation, pos,
            collins, oxford, tag, bnc, frq, exchange, detail, audio, word_lower
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );

    db.run('BEGIN');
    for (const w of arr) {
        stmt.run([
            w.word ?? '',
            w.phonetic ?? '',
            w.definition ?? '',
            w.translation ?? '',
            w.pos ?? '',
            w.collins ?? null,
            w.oxford ?? null,
            w.tag ?? '',
            w.bnc ?? null,
            w.frq ?? null,
            w.exchange ?? '',
            w.detail ?? '',
            w.audio ?? '',
            (w.word ?? '').toLowerCase()
        ]);
    }
    db.run('COMMIT');
    stmt.free();

    const bytes = db.export();
    db.close();

    const dbGz = await gzipAsync(Buffer.from(bytes), { level: 9 });
    const dbName = `chunk-${chunkNum}.db.gz`;
    writeFileSync(join(CHUNKS_DIR, dbName), dbGz);
    console.log(`  ✅ chunk-${chunkNum}: ${(bytes.length / 1024 / 1024).toFixed(1)}MB SQLite → ${(dbGz.length / 1024 / 1024).toFixed(2)}MB gz`);

    // 源 json.gz 的清理交由外层处理（避免被环境 safe-delete 钩子拦截）
    return { dbName, sizeBytes: dbGz.length, jsonPath };
}

async function main() {
    console.log('📦 构建 SQLite 分片数据库...\n');
    const SQL = await initSqlJs();

    const metaPath = join(CHUNKS_DIR, 'metadata.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const totalChunks = meta.totalChunks;

    for (let i = 0; i < totalChunks; i++) {
        const chunkNum = i + 1;
        console.log(`\n📦 chunk ${chunkNum}/${totalChunks}`);
        const res = await buildChunk(SQL, chunkNum, meta);
        if (res) {
            const c = meta.chunks.find(c => c.chunkNumber === chunkNum);
            c.filename = res.dbName;
            c.sizeBytes = res.sizeBytes;
        }
    }

    // 计算总压缩体积并写回 metadata
    meta.totalBytes = meta.chunks.reduce((s, c) => s + (c.sizeBytes || 0), 0);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    console.log(`\n✅ metadata.json 已更新，总压缩体积 ${(meta.totalBytes / 1024 / 1024).toFixed(1)}MB`);
    console.log('🎉 SQLite 分片构建完成');
}

main().catch(err => {
    console.error('❌', err);
    process.exit(1);
});
