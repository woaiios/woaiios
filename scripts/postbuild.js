import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

console.log('Post-build script completed successfully!');
