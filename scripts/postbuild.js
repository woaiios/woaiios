import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync, cpSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Running post-build script...');

// Ensure dist/assets directory exists
const assetsDir = resolve(__dirname, '../dist/assets');
if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
}

// Copy service worker and manifest files
const swSource = resolve(__dirname, '../sw.js');
const swDest = resolve(__dirname, '../dist/sw.js');
const manifestSource = resolve(__dirname, '../manifest.json');
const manifestDest = resolve(__dirname, '../dist/manifest.json');

try {
    copyFileSync(swSource, swDest);
    // Stamp CACHE_VERSION with build time so every deploy gets a fresh cache
    const buildTag = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12); // YYYYMMDDHHmm
    let swContent = readFileSync(swDest, 'utf-8');
    swContent = swContent.replace(
        /const CACHE_VERSION = ['"][^'"]*['"];/,
        `const CACHE_VERSION = 'v2.0.1-build.${buildTag}';`
    );
    writeFileSync(swDest, swContent);
    console.log(`✓ Copied sw.js to dist/ (cache version: v2.0.1-build.${buildTag})`);
} catch (error) {
    console.error('✗ Failed to copy sw.js:', error.message);
    process.exit(1);
}

try {
    copyFileSync(manifestSource, manifestDest);
    console.log('✓ Copied manifest.json to dist/');
} catch (error) {
    console.error('✗ Failed to copy manifest.json:', error.message);
    process.exit(1);
}

// Copy sql.js WASM file
const wasmSource = resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
const wasmDest = resolve(__dirname, '../dist/assets/sql-wasm.wasm');

try {
    copyFileSync(wasmSource, wasmDest);
    console.log('✓ Copied sql-wasm.wasm to dist/assets/');
} catch (error) {
    console.error('✗ Failed to copy sql-wasm.wasm:', error.message);
    process.exit(1);
}

// Copy db-chunks directory
const chunksSource = resolve(__dirname, '../public/db-chunks');
const chunksDest = resolve(__dirname, '../dist/db-chunks');

if (existsSync(chunksSource)) {
    try {
        if (existsSync(chunksDest)) {
            rmSync(chunksDest, { recursive: true });
        }
        cpSync(chunksSource, chunksDest, { recursive: true });
        console.log('✓ Copied db-chunks directory to dist/');
        
        // Remove uncompressed .db files (keep only .gz)
        const files = readdirSync(chunksDest);
        for (const file of files) {
            if (file.endsWith('.db') && !file.endsWith('.db.gz')) {
                const filePath = resolve(chunksDest, file);
                unlinkSync(filePath);
                console.log(`  ✓ Removed uncompressed file: ${file}`);
            }
        }
        
        // 保留全部分片（完整词典，不精简为单块，避免丢失低频词条）
        const slimMetadata = JSON.parse(readFileSync(resolve(chunksDest, 'metadata.json'), 'utf-8'));
        const KEEP_CHUNKS = slimMetadata.totalChunks;
        if (slimMetadata.totalChunks > KEEP_CHUNKS) {
            const removed = slimMetadata.chunks.filter(c => c.chunkNumber > KEEP_CHUNKS);
            for (const c of removed) {
                const f = resolve(chunksDest, c.filename);
                if (existsSync(f)) {
                    // A local dev/preview server may hold the file open — never
                    // let one locked file abort the whole slimming pass
                    try {
                        unlinkSync(f);
                        console.log(`  ✓ Removed chunk file: ${c.filename}`);
                    } catch (e) {
                        console.warn(`  ⚠ Could not remove ${c.filename}: ${e.message}`);
                    }
                }
            }
            slimMetadata.chunks = slimMetadata.chunks.filter(c => c.chunkNumber <= KEEP_CHUNKS);
            slimMetadata.totalChunks = slimMetadata.chunks.length;
            slimMetadata.totalWords = slimMetadata.chunks.reduce((s, c) => s + c.wordCount, 0);
            slimMetadata.totalBytes = slimMetadata.chunks.reduce((s, c) => s + c.sizeBytes, 0);
            writeFileSync(resolve(chunksDest, 'metadata.json'), JSON.stringify(slimMetadata, null, 2));
            console.log(`  ✓ Slimmed dictionary to ${slimMetadata.totalChunks} chunk (${slimMetadata.totalWords.toLocaleString()} words)`);
        }

        // Count and log chunk sizes
        const metadataPath = resolve(chunksDest, 'metadata.json');
        if (existsSync(metadataPath)) {
            const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
            const totalSize = metadata.chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
            console.log(`  Total chunks: ${metadata.totalChunks}, Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        }
    } catch (error) {
        console.error('✗ Failed to copy db-chunks:', error.message);
        process.exit(1);
    }
} else {
    console.warn('⚠ db-chunks directory not found, skipping...');
}

// Compress legacy single-file database (stardict.db) if present.
// 当前项目已迁移至 db-chunks 分片（public/db-chunks），单文件 stardict.db 不再必需，
// 此时跳过压缩且不视为警告，避免测试误判为失败。
const dbSource = resolve(__dirname, '../public/stardict.db');
const dbDest = resolve(__dirname, '../dist/stardict.db.gz');

if (existsSync(dbSource)) {
    try {
        console.log('Compressing stardict.db...');
        const dbBuffer = readFileSync(dbSource);
        const originalSize = (dbBuffer.length / 1024 / 1024).toFixed(2);
        
        const compressed = await gzipAsync(dbBuffer, { level: 9 });
        writeFileSync(dbDest, compressed);
        
        const compressedSize = (compressed.length / 1024 / 1024).toFixed(2);
        const ratio = ((1 - compressed.length / dbBuffer.length) * 100).toFixed(1);
        
        console.log(`✓ Compressed stardict.db: ${originalSize}MB → ${compressedSize}MB (${ratio}% reduction)`);
    } catch (error) {
        console.error('✗ Failed to compress database:', error.message);
        process.exit(1);
    }
} else if (!existsSync(resolve(__dirname, '../public/db-chunks'))) {
    console.warn('⚠ Database file not found, skipping compression');
}

// Remove unnecessary files from dist
const filesToRemove = [
    '../dist/eng-zho.json',
    '../dist/eng-zho.json.gz',
    '../dist/eng_dict.txt',
    '../dist/stardict.db', // Remove uncompressed version
    '../dist/eng-zho.json_res',
    '../dist/test-cahokia.html',
    '../dist/test-cahokia.html.gz',
    '../dist/test-report.html',
    '../dist/test-report.html.gz'
];

console.log('Removing unnecessary files...');
for (const file of filesToRemove) {
    const filePath = resolve(__dirname, file);
    if (existsSync(filePath)) {
        try {
            const stats = await import('fs').then(fs => fs.promises.stat(filePath));
            if (stats.isDirectory()) {
                rmSync(filePath, { recursive: true, force: true });
                console.log(`✓ Removed directory: ${file}`);
            } else {
                unlinkSync(filePath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`✓ Removed file: ${file} (${sizeMB}MB)`);
            }
        } catch (error) {
            console.warn(`⚠ Could not remove ${file}:`, error.message);
        }
    }
}

console.log('Post-build script completed successfully!');
