#!/usr/bin/env node
/**
 * prebuild-inflections — 为已打包的 chunk-N.db.gz 预建 inflections(变形词->原型) 反查表
 * -----------------------------------------------------------------------------
 * 背景：运行时 worker 每次打开分片都要扫全表建这张表（解压后的主要耗时）。
 * 本脚本在 Node 端一次性把表建好写回 .db.gz，worker 检测到表已存在即跳过。
 *
 * 幂等：inflections 表已有数据则跳过该分片；可重复执行。
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gzip, gunzipSync } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CHUNKS_DIR = join(__dirname, '../public/db-chunks');

function hasInflections(db) {
    try {
        const r = db.exec(`SELECT COUNT(*) FROM inflections`);
        return (r[0]?.values?.[0]?.[0] ?? 0) > 0;
    } catch {
        return false;
    }
}

function buildInflections(db) {
    db.run(`CREATE TABLE IF NOT EXISTS inflections(form TEXT, lemma TEXT)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inflections_form ON inflections(form)`);

    const ins = db.prepare(`INSERT INTO inflections(form, lemma) VALUES (?, ?)`);
    const sel = db.prepare(`SELECT word, exchange FROM words`);
    let rows = 0;
    while (sel.step()) {
        const row = sel.getAsObject();
        const ex = row.exchange;
        if (!ex) continue;
        const headLower = String(row.word ?? '').toLowerCase();
        for (const pair of String(ex).split('/')) {
            const idx = pair.indexOf(':');
            if (idx < 0) continue;
            const type = pair.slice(0, idx);
            const val = pair.slice(idx + 1).trim().toLowerCase();
            if (!val || val === headLower) continue;
            if (type === '0') {
                ins.run([headLower, val]);
            } else if (type.length === 1 && 'pdi3rts'.includes(type)) {
                ins.run([val, headLower]);
            }
        }
        rows++;
    }
    sel.reset();
    sel.free();
    ins.free();
    return rows;
}

async function main() {
    console.log('📦 预建 inflections 反查表（现有 .db.gz 分片）...\n');
    const SQL = await initSqlJs();
    const meta = JSON.parse(readFileSync(join(CHUNKS_DIR, 'metadata.json'), 'utf8'));

    let changed = 0;
    for (const chunk of meta.chunks) {
        const file = join(CHUNKS_DIR, chunk.filename);
        const db = new SQL.Database(new Uint8Array(gunzipSync(readFileSync(file))));

        if (hasInflections(db)) {
            console.log(`⏭️  chunk-${chunk.chunkNumber}: inflections 已存在，跳过`);
            db.close();
            continue;
        }

        const rows = buildInflections(db);
        const bytes = db.export();
        db.close();

        const gz = await gzipAsync(Buffer.from(bytes), { level: 9 });
        writeFileSync(file, gz);
        chunk.sizeBytes = gz.length;
        changed++;
        console.log(`✅ chunk-${chunk.chunkNumber}: 扫描 ${rows.toLocaleString()} 行 → ${(gz.length / 1024 / 1024).toFixed(2)}MB gz`);
    }

    meta.totalBytes = meta.chunks.reduce((s, c) => s + (c.sizeBytes || 0), 0);
    writeFileSync(join(CHUNKS_DIR, 'metadata.json'), JSON.stringify(meta, null, 2));
    console.log(`\n🎉 完成：更新 ${changed} 个分片，总压缩体积 ${(meta.totalBytes / 1024 / 1024).toFixed(1)}MB`);
}

main().catch((err) => {
    console.error('❌', err);
    process.exit(1);
});
