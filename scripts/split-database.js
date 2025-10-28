#!/usr/bin/env node
/**
 * Split the stardict.db into 10 chunks based on word frequency
 * High-frequency words (lower BNC/frq values) go into earlier chunks
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NUM_CHUNKS = 10;

async function splitDatabase() {
    console.log('📚 Starting database split process...\n');

    try {
        // Initialize sql.js
        const SQL = await initSqlJs();
        
        // Load source database
        const dbPath = join(__dirname, '../public/stardict.db');
        console.log(`📂 Loading database: ${dbPath}`);
        
        const buffer = readFileSync(dbPath);
        const sourceDb = new SQL.Database(buffer);
        
        console.log(`✅ Database loaded (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)\n`);
        
        // Get total word count
        const countResult = sourceDb.exec("SELECT COUNT(*) FROM words");
        const totalWords = countResult[0].values[0][0];
        console.log(`📊 Total words in database: ${totalWords.toLocaleString()}\n`);
        
        // Calculate words per chunk
        const wordsPerChunk = Math.ceil(totalWords / NUM_CHUNKS);
        console.log(`📦 Words per chunk: ~${wordsPerChunk.toLocaleString()}\n`);
        
        // Create output directory
        const outputDir = join(__dirname, '../public/db-chunks');
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }
        
        // Metadata for all chunks
        const metadata = {
            version: '1.0',
            totalChunks: NUM_CHUNKS,
            totalWords: totalWords,
            chunks: []
        };
        
        console.log('Creating chunks...\n');
        
        for (let i = 0; i < NUM_CHUNKS; i++) {
            const chunkNum = i + 1;
            const offset = i * wordsPerChunk;
            
            console.log(`\n📦 Creating chunk ${chunkNum}/${NUM_CHUNKS}...`);
            
            // Create new database for this chunk
            const chunkDb = new SQL.Database();
            
            // Create the words table structure
            chunkDb.exec(`
                CREATE TABLE words (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    word TEXT NOT NULL,
                    phonetic TEXT,
                    definition TEXT,
                    translation TEXT,
                    pos TEXT,
                    collins INTEGER DEFAULT 0,
                    oxford INTEGER DEFAULT 0,
                    tag TEXT,
                    bnc INTEGER DEFAULT 0,
                    frq INTEGER DEFAULT 0,
                    exchange TEXT,
                    detail TEXT,
                    audio TEXT
                );
                CREATE INDEX idx_word ON words(word);
            `);
            
            // Copy data with frequency-based ordering
            // Priority: BNC frequency (lower = more common), then frq, then collins
            const query = `
                SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio
                FROM words
                ORDER BY 
                    CASE WHEN bnc > 0 THEN bnc ELSE 999999 END ASC,
                    CASE WHEN frq > 0 THEN frq ELSE 999999 END ASC,
                    collins DESC
                LIMIT ${wordsPerChunk} OFFSET ${offset}
            `;
            
            const result = sourceDb.exec(query);
            
            if (result.length > 0 && result[0].values.length > 0) {
                const words = result[0].values;
                console.log(`  📝 Processing ${words.length.toLocaleString()} words...`);
                
                // Insert words into chunk database
                const stmt = chunkDb.prepare(`
                    INSERT INTO words (word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const word of words) {
                    stmt.run(word);
                }
                stmt.free();
                
                // Export chunk database
                const chunkData = chunkDb.export();
                const chunkBuffer = Buffer.from(chunkData);
                
                // Save uncompressed for development
                const chunkPath = join(outputDir, `chunk-${chunkNum}.db`);
                writeFileSync(chunkPath, chunkBuffer);
                
                // Compress chunk
                console.log(`  🗜️  Compressing chunk ${chunkNum}...`);
                const compressed = await gzipAsync(chunkBuffer, { level: 9 });
                const compressedPath = join(outputDir, `chunk-${chunkNum}.db.gz`);
                writeFileSync(compressedPath, compressed);
                
                const originalSize = chunkBuffer.length / 1024 / 1024;
                const compressedSize = compressed.length / 1024 / 1024;
                const ratio = ((1 - compressed.length / chunkBuffer.length) * 100).toFixed(1);
                
                console.log(`  ✅ Chunk ${chunkNum}: ${originalSize.toFixed(2)}MB → ${compressedSize.toFixed(2)}MB (${ratio}% reduction)`);
                
                // Add to metadata
                metadata.chunks.push({
                    chunkNumber: chunkNum,
                    filename: `chunk-${chunkNum}.db.gz`,
                    wordCount: words.length,
                    sizeBytes: compressed.length,
                    offset: offset,
                    priority: chunkNum // Lower number = higher priority (more frequent words)
                });
            }
            
            chunkDb.close();
        }
        
        // Save metadata
        const metadataPath = join(outputDir, 'metadata.json');
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log(`\n✅ Metadata saved: ${metadataPath}`);
        
        // Summary
        console.log('\n📊 Split Summary:');
        console.log(`  Total chunks: ${NUM_CHUNKS}`);
        console.log(`  Total words: ${totalWords.toLocaleString()}`);
        const totalSize = metadata.chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
        console.log(`  Total compressed size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Average chunk size: ${(totalSize / NUM_CHUNKS / 1024 / 1024).toFixed(2)}MB`);
        
        sourceDb.close();
        console.log('\n✨ Database split completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

splitDatabase();
