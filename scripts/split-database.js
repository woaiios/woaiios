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
                
                // Convert to JSON array of objects
                const wordObjects = words.map(row => ({
                    word: row[0],
                    phonetic: row[1],
                    definition: row[2],
                    translation: row[3],
                    pos: row[4],
                    collins: row[5],
                    oxford: row[6],
                    tag: row[7],
                    bnc: row[8],
                    frq: row[9],
                    exchange: row[10],
                    detail: row[11],
                    audio: row[12]
                }));
                
                // Convert to JSON string
                const jsonString = JSON.stringify(wordObjects);
                const jsonBuffer = Buffer.from(jsonString, 'utf8');
                
                // Compress chunk (only save .gz files)
                console.log(`  🗜️  Compressing chunk ${chunkNum}...`);
                const compressed = await gzipAsync(jsonBuffer, { level: 9 });
                const compressedPath = join(outputDir, `chunk-${chunkNum}.json.gz`);
                writeFileSync(compressedPath, compressed);
                
                const originalSize = jsonBuffer.length / 1024 / 1024;
                const compressedSize = compressed.length / 1024 / 1024;
                const ratio = ((1 - compressed.length / jsonBuffer.length) * 100).toFixed(1);
                
                console.log(`  ✅ Chunk ${chunkNum}: ${originalSize.toFixed(2)}MB → ${compressedSize.toFixed(2)}MB (${ratio}% reduction)`);
                
                // Add to metadata
                metadata.chunks.push({
                    chunkNumber: chunkNum,
                    filename: `chunk-${chunkNum}.json.gz`,
                    wordCount: words.length,
                    sizeBytes: compressed.length,
                    offset: offset,
                    priority: chunkNum // Lower number = higher priority (more frequent words)
                });
            }
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
