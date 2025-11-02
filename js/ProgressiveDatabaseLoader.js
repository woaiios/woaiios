/**
 * ProgressiveDatabaseLoader Module
 * Implements progressive database loading with caching and offline support
 * Loads database chunks in order of word frequency (high-frequency words first)
 */
import pako from 'pako';
import { scheduleIdleTask, processInChunks } from './PerformanceUtils.js';

export class ProgressiveDatabaseLoader {
    constructor(SQL) {
        this.SQL = SQL;
        this.db = null;
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
     * Initialize the loader and create empty database
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
            
            // Create empty database with schema
            this.db = new this.SQL.Database();
            this.db.exec(`
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
            
            // Decompress
            let compressedBuffer = await response.arrayBuffer();
            let buffer;
            
            const contentEncoding = response.headers.get('Content-Encoding');
            
            if (contentEncoding === 'gzip' || compressedBuffer.byteLength > chunkInfo.sizeBytes * 1.5) {
                buffer = compressedBuffer;
            } else {
                const compressedArray = new Uint8Array(compressedBuffer);
                const decompressedArray = pako.ungzip(compressedArray);
                buffer = decompressedArray.buffer;
            }
            
            // Load chunk database
            const chunkDb = new this.SQL.Database(new Uint8Array(buffer));
            
            // Copy words from chunk to main database
            const result = chunkDb.exec('SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio FROM words');
            
            if (result.length > 0 && result[0].values.length > 0) {
                const stmt = this.db.prepare(`
                    INSERT INTO words (word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const row of result[0].values) {
                    stmt.run(row);
                }
                stmt.free();
            }
            
            chunkDb.close();
            
            // Update progress
            this.loadedChunks.add(chunkNumber);
            this.loadedBytes += chunkInfo.sizeBytes;
            this.loadingProgress = (this.loadedBytes / this.totalBytes) * 100;
            
            console.log(`✅ Chunk ${chunkNumber} loaded (${this.loadingProgress.toFixed(1)}% complete)`);
            
            this.emit('chunkLoaded', {
                chunkNumber,
                loaded: this.loadedChunks.size,
                total: this.metadata.totalChunks,
                percentage: this.loadingProgress
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
    async loadPriorityChunks(count = 3) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        console.log(`📚 Loading ${count} priority chunks...`);
        
        for (let i = 1; i <= Math.min(count, this.metadata.totalChunks); i++) {
            await this.loadChunk(i);
        }
        
        // Continue loading remaining chunks in background
        if (count < this.metadata.totalChunks) {
            this.loadRemainingChunksInBackground(count + 1);
        }
        
        return true;
    }

    /**
     * Load remaining chunks in the background
     */
    async loadRemainingChunksInBackground(startFrom) {
        console.log(`🔄 Loading remaining chunks in background starting from ${startFrom}...`);
        
        for (let i = startFrom; i <= this.metadata.totalChunks; i++) {
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
     * Get the database instance
     */
    getDatabase() {
        return this.db;
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

    /**
     * Close database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
