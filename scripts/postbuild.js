import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync } from 'fs';
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

// Compress database file with gzip
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
} else {
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
