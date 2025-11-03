/**
 * DatabaseLoaderWorker
 * Web Worker for handling database loading operations
 * Performs heavy operations (decompression, parsing) off the main thread
 */

import pako from 'pako';

// Worker state
let metadata = null;
let loadedChunks = new Set();
let totalBytes = 0;
let loadedBytes = 0;

/**
 * Handle messages from main thread
 */
self.onmessage = async (event) => {
    const { id, type, payload } = event.data;
    
    try {
        let result;
        
        switch (type) {
            case 'initialize':
                result = await handleInitialize(payload);
                break;
                
            case 'loadChunk':
                result = await handleLoadChunk(payload);
                break;
                
            case 'getProgress':
                result = handleGetProgress();
                break;
                
            case 'isReady':
                result = handleIsReady();
                break;
                
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
        
        // Send success response
        self.postMessage({
            id,
            type: 'success',
            result
        });
        
    } catch (error) {
        // Send error response
        self.postMessage({
            id,
            type: 'error',
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
};

/**
 * Initialize the worker and load metadata
 */
async function handleInitialize(payload) {
    const { metadataUrl } = payload;
    
    console.log('[Worker] 🚀 Initializing database loader...');
    
    // Fetch metadata
    const response = await fetch(metadataUrl);
    if (!response.ok) {
        throw new Error(`Failed to load metadata: ${response.status}`);
    }
    
    metadata = await response.json();
    totalBytes = metadata.chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
    loadedChunks.clear();
    loadedBytes = 0;
    
    console.log(`[Worker] 📊 Metadata loaded: ${metadata.totalChunks} chunks, ${metadata.totalWords.toLocaleString()} words`);
    
    return {
        totalChunks: metadata.totalChunks,
        totalWords: metadata.totalWords,
        totalBytes
    };
}

/**
 * Load and process a specific chunk
 */
async function handleLoadChunk(payload) {
    const { chunkNumber, baseUrl } = payload;
    
    if (!metadata) {
        throw new Error('Worker not initialized');
    }
    
    if (loadedChunks.has(chunkNumber)) {
        console.log(`[Worker] ⚠️ Chunk ${chunkNumber} already loaded`);
        return {
            chunkNumber,
            alreadyLoaded: true,
            progress: calculateProgress()
        };
    }
    
    const chunkInfo = metadata.chunks.find(c => c.chunkNumber === chunkNumber);
    if (!chunkInfo) {
        throw new Error(`Chunk ${chunkNumber} not found in metadata`);
    }
    
    console.log(`[Worker] 📥 Downloading chunk ${chunkNumber}/${metadata.totalChunks} (${chunkInfo.wordCount.toLocaleString()} words)...`);
    
    // Download chunk
    const chunkUrl = `${baseUrl}${chunkInfo.filename}`;
    const response = await fetch(chunkUrl);
    if (!response.ok) {
        throw new Error(`Failed to load chunk ${chunkNumber}: ${response.status}`);
    }
    
    // Get buffer
    let buffer = await response.arrayBuffer();
    let jsonString;
    
    // Check if server already decompressed
    const contentEncoding = response.headers.get('Content-Encoding');
    
    if (contentEncoding === 'gzip') {
        // Server auto-decompressed
        console.log(`[Worker]   ℹ️ Server auto-decompressed chunk ${chunkNumber}`);
        jsonString = new TextDecoder('utf-8').decode(buffer);
    } else {
        // Decompress manually (this heavy operation now runs in worker!)
        try {
            console.log(`[Worker]   🗜️ Decompressing chunk ${chunkNumber}...`);
            const startTime = performance.now();
            
            const compressedArray = new Uint8Array(buffer);
            const decompressedArray = pako.ungzip(compressedArray);
            jsonString = new TextDecoder('utf-8').decode(decompressedArray);
            
            const decompressTime = performance.now() - startTime;
            console.log(`[Worker]   ✅ Decompressed in ${decompressTime.toFixed(2)}ms`);
        } catch (e) {
            // Fallback: try as plain text
            console.log(`[Worker]   ℹ️ Pako failed, trying as plain text...`);
            jsonString = new TextDecoder('utf-8').decode(buffer);
        }
    }
    
    // Parse JSON (this heavy operation now runs in worker!)
    console.log(`[Worker]   📝 Parsing JSON...`);
    const startTime = performance.now();
    const chunkWords = JSON.parse(jsonString);
    const parseTime = performance.now() - startTime;
    console.log(`[Worker]   ✅ Parsed ${chunkWords.length.toLocaleString()} words in ${parseTime.toFixed(2)}ms`);
    
    // Update progress
    loadedChunks.add(chunkNumber);
    loadedBytes += chunkInfo.sizeBytes;
    
    const progress = calculateProgress();
    console.log(`[Worker] ✅ Chunk ${chunkNumber} completed (${progress.percentage.toFixed(1)}% total)`);
    
    return {
        chunkNumber,
        chunkWords,  // Return the parsed words
        wordCount: chunkWords.length,
        progress
    };
}

/**
 * Get current loading progress
 */
function handleGetProgress() {
    return calculateProgress();
}

/**
 * Check if worker is ready
 */
function handleIsReady() {
    return {
        isInitialized: metadata !== null,
        hasLoadedChunks: loadedChunks.size > 0,
        isReady: metadata !== null && loadedChunks.size > 0
    };
}

/**
 * Calculate current progress
 */
function calculateProgress() {
    if (!metadata) {
        return {
            percentage: 0,
            loadedChunks: 0,
            totalChunks: 0,
            loadedBytes: 0,
            totalBytes: 0
        };
    }
    
    return {
        percentage: totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 0,
        loadedChunks: loadedChunks.size,
        totalChunks: metadata.totalChunks,
        loadedBytes,
        totalBytes
    };
}

console.log('[Worker] 🔧 DatabaseLoaderWorker initialized and ready');
