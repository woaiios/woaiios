/**
 * ProgressiveDatabaseLoader Module
 * Implements progressive database loading with caching and offline support
 * Loads database chunks in order of word frequency (high-frequency words first)
 */
import pako from 'pako';
import { scheduleIdleTask, processInChunks } from './PerformanceUtils.js';

export class ProgressiveDatabaseLoader {
    constructor() {
        this.metadata = null;
        this.loadedChunks = new Set();
        this.loadingProgress = 0;
        this.totalBytes = 0;
        this.loadedBytes = 0;
        this.isInitialized = false;
        this.listeners = {
            progress: [],
            chunkLoaded: [],
            complete: [],
            error: []
        };
    }

    /**
     * Initialize the loader and load metadata
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Progressive Database Loader...');
            
            // Load metadata from server
            const metadataPath = import.meta.env.DEV 
                ? '/db-chunks/metadata.json'
                : `${import.meta.env.BASE_URL}db-chunks/metadata.json`;
            
            console.log('📥 Fetching metadata...');
            const response = await fetch(metadataPath);
            if (!response.ok) {
                throw new Error(`Failed to load metadata: ${response.status}`);
            }
            
            this.metadata = await response.json();
            this.totalBytes = this.metadata.chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
            
            console.log(`📊 Metadata loaded: ${this.metadata.totalChunks} chunks, ${this.metadata.totalWords.toLocaleString()} words`);
            
            this.isInitialized = true;
            this.emit('progress', { loaded: 0, total: this.totalBytes, percentage: 0, message: 'Initialized' });
            
            return true;
        } catch (error) {
            console.error('Error initializing progressive loader:', error);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Load a specific chunk
     */
    async loadChunk(chunkNumber) {
        if (!this.isInitialized) {
            throw new Error('Loader not initialized');
        }
        
        if (this.loadedChunks.has(chunkNumber)) {
            console.log(`⚠️ Chunk ${chunkNumber} already loaded`);
            return true;
        }
        
        try {
            const chunkInfo = this.metadata.chunks.find(c => c.chunkNumber === chunkNumber);
            if (!chunkInfo) {
                throw new Error(`Chunk ${chunkNumber} not found in metadata`);
            }
            
            // Download chunk from server
            console.log(`📥 Downloading chunk ${chunkNumber}/${this.metadata.totalChunks} (${chunkInfo.wordCount.toLocaleString()} words)...`);
            
            this.emit('progress', {
                loaded: this.loadedBytes,
                total: this.totalBytes,
                percentage: this.loadingProgress,
                message: `Downloading: chunk ${chunkNumber}/${this.metadata.totalChunks}`
            });
            
            const chunkPath = import.meta.env.DEV 
                ? `/db-chunks/${chunkInfo.filename}`
                : `${import.meta.env.BASE_URL}db-chunks/${chunkInfo.filename}`;
            
            const response = await fetch(chunkPath);
            if (!response.ok) {
                throw new Error(`Failed to load chunk ${chunkNumber}: ${response.status}`);
            }
            
            // Get response data
            let buffer = await response.arrayBuffer();
            let jsonString;
            
            // Check if already decompressed by server (Content-Encoding: gzip)
            const contentEncoding = response.headers.get('Content-Encoding');
            
            if (contentEncoding === 'gzip') {
                // Server already decompressed it
                console.log(`  ℹ️ Server auto-decompressed chunk ${chunkNumber}`);
                jsonString = new TextDecoder('utf-8').decode(buffer);
            } else {
                // Need to decompress manually
                try {
                    console.log(`  🗜️ Decompressing chunk ${chunkNumber}...`);
                    const compressedArray = new Uint8Array(buffer);
                    const decompressedArray = pako.ungzip(compressedArray);
                    jsonString = new TextDecoder('utf-8').decode(decompressedArray);
                } catch (e) {
                    // If pako fails, try reading as plain text (might already be decompressed)
                    console.log(`  ℹ️ Pako failed, trying as plain text...`);
                    jsonString = new TextDecoder('utf-8').decode(buffer);
                }
            }
            
            // Parse JSON
            const chunkWords = JSON.parse(jsonString);
            
            console.log(`✅ Chunk ${chunkNumber} decompressed and parsed: ${chunkWords.length.toLocaleString()} words`);
            
            // Update progress
            this.loadedChunks.add(chunkNumber);
            this.loadedBytes += chunkInfo.sizeBytes;
            this.loadingProgress = (this.loadedBytes / this.totalBytes) * 100;
            
            console.log(`✅ Chunk ${chunkNumber} loaded (${this.loadingProgress.toFixed(1)}% complete)`);
            
            this.emit('chunkLoaded', {
                chunkNumber,
                loaded: this.loadedChunks.size,
                total: this.metadata.totalChunks,
                percentage: this.loadingProgress,
                chunkWords  // Array of word objects
            });
            
            this.emit('progress', {
                loaded: this.loadedBytes,
                total: this.totalBytes,
                percentage: this.loadingProgress,
                message: `Loaded chunk ${chunkNumber}/${this.metadata.totalChunks}`
            });
            
            return true;
        } catch (error) {
            console.error(`Error loading chunk ${chunkNumber}:`, error);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Load chunks progressively (in order of priority)
     */
    async loadAllChunks() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        console.log('📚 Starting progressive database loading...');
        
        // Load chunks in order (1 to N)
        for (let i = 1; i <= this.metadata.totalChunks; i++) {
            await this.loadChunk(i);
        }
        
        console.log('✨ All chunks loaded successfully!');
        this.emit('complete', {
            totalChunks: this.metadata.totalChunks,
            totalWords: this.metadata.totalWords
        });
        
        return true;
    }

    /**
     * Load only the first N chunks (for quick start)
     */
    async loadPriorityChunks(count = 1) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        console.log(`📚 Loading ${count} priority chunks...`);
        
        for (let i = 1; i <= Math.min(count, this.metadata.totalChunks); i++) {
            await this.loadChunk(i);
        }
        
        // Continue loading remaining chunks in background
        if (count < this.metadata.totalChunks) {
            // Use setTimeout to ensure it runs asynchronously in the background
            setTimeout(() => {
                this.loadRemainingChunksInBackground(count + 1);
            }, 100);
        }
        
        return true;
    }

    /**
     * Load remaining chunks in the background
     */
    async loadRemainingChunksInBackground(startFrom) {
        console.log(`🔄 Loading remaining chunks in background starting from ${startFrom}...`);
        console.log(`📊 Total chunks to load: ${this.metadata.totalChunks - startFrom + 1}`);
        
        for (let i = startFrom; i <= this.metadata.totalChunks; i++) {
            console.log(`⏳ Loading chunk ${i}/${this.metadata.totalChunks} in background...`);
            await this.loadChunk(i);
            
            // Small delay between chunks to not block the UI
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('✨ All chunks loaded successfully!');
        this.emit('complete', {
            totalChunks: this.metadata.totalChunks,
            totalWords: this.metadata.totalWords
        });
    }

    /**
     * Check if database is ready for use
     */
    isReady() {
        return this.isInitialized && this.loadedChunks.size > 0;
    }

    /**
     * Get loading progress
     */
    getProgress() {
        return {
            percentage: this.loadingProgress,
            loadedChunks: this.loadedChunks.size,
            totalChunks: this.metadata ? this.metadata.totalChunks : 0,
            loadedBytes: this.loadedBytes,
            totalBytes: this.totalBytes
        };
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}
