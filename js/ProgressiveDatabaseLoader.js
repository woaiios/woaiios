/**
 * ProgressiveDatabaseLoader Module
 * Implements progressive database loading with Web Worker for non-blocking operations
 * Loads database chunks in order of word frequency (high-frequency words first)
 * All heavy operations (decompression, parsing) run in a background worker thread
 */
import { WorkerBridge } from './WorkerBridge.js';
import DatabaseWorker from '../workers/DatabaseLoaderWorker.js?worker';

export class ProgressiveDatabaseLoader {
    constructor() {
        this.metadata = null;
        this.loadedChunks = new Set();
        this.loadingProgress = 0;
        this.totalBytes = 0;
        this.loadedBytes = 0;
        this.isInitialized = false;
        this.workerBridge = null;
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
            console.log('🚀 Initializing Progressive Database Loader with Web Worker...');
            
            // Initialize worker using Vite's worker import
            this.workerBridge = new WorkerBridge(DatabaseWorker);
            await this.workerBridge.initialize();
            
            // Prepare metadata URL - use BASE_URL for both dev and production
            const metadataUrl = `${import.meta.env.BASE_URL}db-chunks/metadata.json`;
            
            console.log('📥 Initializing worker with metadata...');
            const result = await this.workerBridge.sendMessage('initialize', { metadataUrl });
            
            this.metadata = result;
            this.totalBytes = result.totalBytes;
            
            console.log(`📊 Metadata loaded: ${result.totalChunks} chunks, ${result.totalWords.toLocaleString()} words`);
            console.log('✅ Web Worker is ready - heavy operations will not block UI!');
            
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
     * Load a specific chunk using Web Worker
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
            console.log(`📥 Requesting chunk ${chunkNumber}/${this.metadata.totalChunks} from worker...`);
            
            this.emit('progress', {
                loaded: this.loadedBytes,
                total: this.totalBytes,
                percentage: this.loadingProgress,
                message: `Loading chunk ${chunkNumber}/${this.metadata.totalChunks} (in worker)`
            });
            
            // Prepare base URL for worker - use BASE_URL for both dev and production
            const baseUrl = `${import.meta.env.BASE_URL}db-chunks/`;
            
            // Send to worker - all heavy operations happen there!
            const result = await this.workerBridge.sendMessage('loadChunk', {
                chunkNumber,
                baseUrl
            });
            
            if (result.alreadyLoaded) {
                return true;
            }
            
            // Update local state
            this.loadedChunks.add(chunkNumber);
            this.loadedBytes = result.progress.loadedBytes;
            this.loadingProgress = result.progress.percentage;
            
            console.log(`✅ Chunk ${chunkNumber} loaded: ${result.wordCount.toLocaleString()} words (${this.loadingProgress.toFixed(1)}% complete)`);
            
            // Emit events
            this.emit('chunkLoaded', {
                chunkNumber,
                loaded: this.loadedChunks.size,
                total: this.metadata.totalChunks,
                percentage: this.loadingProgress,
                chunkWords: result.chunkWords  // Parsed words from worker
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
     * Cleanup and terminate worker
     */
    cleanup() {
        if (this.workerBridge) {
            this.workerBridge.terminate();
            this.workerBridge = null;
            console.log('🧹 Worker terminated and cleaned up');
        }
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
