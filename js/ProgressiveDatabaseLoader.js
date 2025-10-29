/**
 * ProgressiveDatabaseLoader Module
 * Implements progressive database loading with caching and offline support
 * Loads database chunks in order of word frequency (high-frequency words first)
 */
import pako from 'pako';

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
        
        // IndexedDB for caching
        this.dbName = 'WordDiscovererCache';
        this.dbVersion = 1;
        this.cacheDB = null;
    }

    /**
     * Initialize IndexedDB for caching
     */
    async initializeCache() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.warn('Failed to open IndexedDB, continuing without cache');
                resolve(null);
            };
            
            request.onsuccess = (event) => {
                this.cacheDB = event.target.result;
                console.log('✅ IndexedDB cache initialized');
                resolve(this.cacheDB);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('chunks')) {
                    db.createObjectStore('chunks', { keyPath: 'chunkNumber' });
                }
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Save chunk to cache
     */
    async saveChunkToCache(chunkNumber, data) {
        if (!this.cacheDB) return;
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.cacheDB.transaction(['chunks'], 'readwrite');
                const store = transaction.objectStore('chunks');
                
                // Convert ArrayBuffer to Uint8Array for better IndexedDB compatibility
                // IndexedDB handles Uint8Array more reliably across different browsers
                let uint8Data;
                if (data instanceof ArrayBuffer) {
                    uint8Data = new Uint8Array(data);
                } else if (data instanceof Uint8Array) {
                    uint8Data = data;
                } else {
                    throw new TypeError('Data must be ArrayBuffer or Uint8Array');
                }
                
                const request = store.put({
                    chunkNumber: chunkNumber,
                    data: uint8Data,
                    timestamp: Date.now(),
                    version: this.metadata.version  // Add version for cache invalidation
                });
                
                request.onsuccess = () => {
                    console.log(`💾 Cached chunk ${chunkNumber}`);
                    resolve();
                };
                request.onerror = (e) => {
                    console.warn(`Failed to cache chunk ${chunkNumber}:`, e.target.error);
                    resolve(); // Don't fail if caching fails
                };
            } catch (error) {
                console.warn(`Error caching chunk ${chunkNumber}:`, error);
                resolve();
            }
        });
    }

    /**
     * Load chunk from cache
     */
    async loadChunkFromCache(chunkNumber) {
        if (!this.cacheDB) return null;
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.cacheDB.transaction(['chunks'], 'readonly');
                const store = transaction.objectStore('chunks');
                const request = store.get(chunkNumber);
                
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    if (result && result.data) {
                        // Check version match for cache invalidation
                        if (result.version && result.version !== this.metadata.version) {
                            console.log(`⚠️ Cache version mismatch for chunk ${chunkNumber}, re-downloading`);
                            resolve(null);
                            return;
                        }
                        console.log(`📦 Loaded chunk ${chunkNumber} from cache`);
                        // Convert Uint8Array back to ArrayBuffer for sql.js
                        let buffer;
                        if (result.data instanceof Uint8Array) {
                            buffer = result.data.buffer;
                        } else if (result.data instanceof ArrayBuffer) {
                            buffer = result.data;
                        } else {
                            console.warn(`Unexpected data type in cache for chunk ${chunkNumber}, re-downloading`);
                            resolve(null);
                            return;
                        }
                        resolve(buffer);
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = (e) => {
                    console.warn(`Error loading chunk ${chunkNumber} from cache:`, e.target.error);
                    resolve(null);
                };
            } catch (error) {
                console.warn(`Error accessing cache for chunk ${chunkNumber}:`, error);
                resolve(null);
            }
        });
    }

    /**
     * Save metadata to cache
     */
    async saveMetadataToCache(metadata) {
        if (!this.cacheDB) return;
        
        return new Promise((resolve, reject) => {
            const transaction = this.cacheDB.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            const request = store.put({
                key: 'metadata',
                data: metadata,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => resolve(); // Don't fail if caching fails
        });
    }

    /**
     * Load metadata from cache
     */
    async loadMetadataFromCache() {
        if (!this.cacheDB) return null;
        
        return new Promise((resolve, reject) => {
            const transaction = this.cacheDB.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.get('metadata');
            
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result && result.data) {
                    console.log('✅ Loaded metadata from cache');
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    }

    /**
     * Check if chunk is cached
     */
    async isChunkCached(chunkNumber) {
        const data = await this.loadChunkFromCache(chunkNumber);
        return data !== null;
    }

    /**
     * Initialize the loader and create empty database
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Progressive Database Loader...');
            
            // Initialize cache
            await this.initializeCache();
            
            // Try to load metadata from cache first
            let metadata = await this.loadMetadataFromCache();
            
            if (!metadata) {
                // Load metadata from server
                const metadataPath = import.meta.env.DEV 
                    ? '/db-chunks/metadata.json'
                    : `${import.meta.env.BASE_URL}db-chunks/metadata.json`;
                
                console.log('📥 Fetching metadata...');
                const response = await fetch(metadataPath);
                if (!response.ok) {
                    throw new Error(`Failed to load metadata: ${response.status}`);
                }
                
                metadata = await response.json();
                
                // Save to cache
                await this.saveMetadataToCache(metadata);
            }
            
            this.metadata = metadata;
            this.totalBytes = metadata.chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
            
            console.log(`📊 Metadata loaded: ${metadata.totalChunks} chunks, ${metadata.totalWords.toLocaleString()} words`);
            
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
            
            // Try to load from cache first
            let buffer = await this.loadChunkFromCache(chunkNumber);
            let fromCache = false;
            
            if (buffer) {
                // Loaded from cache
                fromCache = true;
                console.log(`📦 Loading chunk ${chunkNumber}/${this.metadata.totalChunks} from cache (${chunkInfo.wordCount.toLocaleString()} words)...`);
                
                // Update progress with cache message
                this.emit('progress', {
                    loaded: this.loadedBytes,
                    total: this.totalBytes,
                    percentage: this.loadingProgress,
                    message: `Loading from cache: chunk ${chunkNumber}/${this.metadata.totalChunks}`,
                    fromCache: true
                });
                
                // Add a minimal delay to make progress visible when loading from cache
                // This provides visual feedback that the app is loading (not frozen)
                // Only delay priority chunks that load very quickly
                if (chunkNumber <= 3) {
                    // Very short delay (100ms) just to ensure progress bar is visible
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } else {
                // Download from server
                console.log(`📥 Downloading chunk ${chunkNumber}/${this.metadata.totalChunks} (${chunkInfo.wordCount.toLocaleString()} words)...`);
                
                // Update progress with download message
                this.emit('progress', {
                    loaded: this.loadedBytes,
                    total: this.totalBytes,
                    percentage: this.loadingProgress,
                    message: `Downloading: chunk ${chunkNumber}/${this.metadata.totalChunks}`,
                    fromCache: false
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
                
                // Check if Vite already decompressed the file (Content-Encoding header)
                // In development, Vite automatically decompresses .gz files and serves them with Content-Encoding: gzip
                // This means the browser receives the decompressed data but arrayBuffer() returns decompressed data
                const contentEncoding = response.headers.get('Content-Encoding');
                
                // Heuristic: If file size is significantly larger than expected compressed size,
                // it's likely already decompressed. Factor of 1.5x accounts for metadata overhead.
                if (contentEncoding === 'gzip' || compressedBuffer.byteLength > chunkInfo.sizeBytes * 1.5) {
                    // File was already decompressed by the browser or is not actually compressed
                    buffer = compressedBuffer;
                } else {
                    // Use pako for manual decompression
                    const compressedArray = new Uint8Array(compressedBuffer);
                    const decompressedArray = pako.ungzip(compressedArray);
                    buffer = decompressedArray.buffer;
                }
                
                // Save to cache
                await this.saveChunkToCache(chunkNumber, buffer);
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
            
            const statusIcon = fromCache ? '📦' : '✅';
            const statusText = fromCache ? 'from cache' : 'downloaded';
            console.log(`${statusIcon} Chunk ${chunkNumber} loaded ${statusText} (${this.loadingProgress.toFixed(1)}% complete)`);
            
            this.emit('chunkLoaded', {
                chunkNumber,
                loaded: this.loadedChunks.size,
                total: this.metadata.totalChunks,
                percentage: this.loadingProgress,
                fromCache: fromCache
            });
            
            this.emit('progress', {
                loaded: this.loadedBytes,
                total: this.totalBytes,
                percentage: this.loadingProgress,
                message: `Loaded chunk ${chunkNumber}/${this.metadata.totalChunks} ${fromCache ? '(cached)' : ''}`,
                fromCache: fromCache
            });
            
            return true;
        } catch (error) {
            console.error(`Error loading chunk ${chunkNumber}:`, error);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                chunkNumber
            });
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
        if (this.cacheDB) {
            this.cacheDB.close();
            this.cacheDB = null;
        }
    }
}
