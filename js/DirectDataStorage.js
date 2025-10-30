/**
 * DirectDataStorage Module
 * Stores word data directly in IndexedDB for faster lookups
 * Optimized for querying 300 words in under 50ms
 */

export class DirectDataStorage {
    constructor() {
        this.dbName = 'WordDiscovererDirectDB';
        this.dbVersion = 1;
        this.db = null;
        this.isInitialized = false;
        this.memoryCache = new Map(); // In-memory LRU cache
        this.maxCacheSize = 10000; // Cache up to 10k words in memory
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            totalQueries: 0
        };
    }

    /**
     * Initialize IndexedDB for direct data storage
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('Failed to open DirectDataStorage IndexedDB');
                reject(new Error('Failed to initialize DirectDataStorage'));
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isInitialized = true;
                console.log('✅ DirectDataStorage initialized');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store for words with word as key
                if (!db.objectStoreNames.contains('words')) {
                    const wordStore = db.createObjectStore('words', { keyPath: 'word' });
                    // Create index for faster lookups
                    wordStore.createIndex('word_lower', 'word_lower', { unique: false });
                }
                
                // Create object store for metadata
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
                
                console.log('✅ DirectDataStorage schema created');
            };
        });
    }

    /**
     * Import data from SQL database into IndexedDB
     * This is a one-time migration process
     * Uses idle callbacks to avoid blocking main thread
     */
    async importFromDatabase(sqlDB, progressCallback = null) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log('🔄 Starting data import to DirectDataStorage...');
        const startTime = Date.now();
        
        try {
            // Check if data already imported
            const metadata = await this.getMetadata('importComplete');
            if (metadata && metadata.value === true) {
                console.log('✅ Data already imported, skipping');
                return true;
            }

            // Get all words from SQL database
            const result = sqlDB.exec(`
                SELECT word, phonetic, definition, translation, pos, collins, oxford, 
                       tag, bnc, frq, exchange, detail, audio 
                FROM words
            `);

            if (result.length === 0 || result[0].values.length === 0) {
                throw new Error('No data found in SQL database');
            }

            const rows = result[0].values;
            const totalRows = rows.length;
            console.log(`📊 Importing ${totalRows.toLocaleString()} words...`);

            // Batch insert for better performance
            const batchSize = 1000;
            let importedCount = 0;

            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                
                const transaction = this.db.transaction(['words'], 'readwrite');
                const store = transaction.objectStore('words');

                for (const row of batch) {
                    const wordData = {
                        word: row[0],
                        word_lower: row[0].toLowerCase(),
                        phonetic: row[1] || '',
                        definition: row[2] || '',
                        translation: row[3] || '',
                        pos: row[4] || '',
                        collins: parseInt(row[5]) || 0,
                        oxford: row[6] === '1' || row[6] === 1,
                        tag: row[7] || '',
                        bnc: parseInt(row[8]) || 0,
                        frq: parseInt(row[9]) || 0,
                        exchange: row[10] || '',
                        detail: row[11] || '',
                        audio: row[12] || ''
                    };
                    
                    store.put(wordData);
                }

                await new Promise((resolve, reject) => {
                    transaction.oncomplete = resolve;
                    transaction.onerror = () => reject(transaction.error);
                });

                importedCount += batch.length;
                
                if (progressCallback) {
                    progressCallback({
                        imported: importedCount,
                        total: totalRows,
                        percentage: (importedCount / totalRows) * 100
                    });
                }

                // Log progress every 10k words
                if (importedCount % 10000 === 0 || importedCount === totalRows) {
                    console.log(`📥 Imported ${importedCount.toLocaleString()}/${totalRows.toLocaleString()} words (${((importedCount/totalRows)*100).toFixed(1)}%)`);
                }
                
                // Yield to main thread every few batches to keep UI responsive
                if (i % (batchSize * 3) === 0 && i + batchSize < rows.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Mark import as complete
            await this.setMetadata('importComplete', true);
            await this.setMetadata('importDate', new Date().toISOString());
            await this.setMetadata('totalWords', totalRows);

            const duration = Date.now() - startTime;
            console.log(`✅ Import completed in ${(duration/1000).toFixed(2)}s`);
            console.log(`📊 Total words imported: ${importedCount.toLocaleString()}`);

            return true;
        } catch (error) {
            console.error('❌ Error importing data:', error);
            throw error;
        }
    }

    /**
     * Query a single word (optimized with caching)
     */
    async queryWord(word) {
        if (!this.isInitialized) {
            return null;
        }

        this.stats.totalQueries++;
        const lowerWord = word.toLowerCase();

        // Check memory cache first
        if (this.memoryCache.has(lowerWord)) {
            this.stats.cacheHits++;
            return this.memoryCache.get(lowerWord);
        }

        this.stats.cacheMisses++;

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['words'], 'readonly');
                const store = transaction.objectStore('words');
                const index = store.index('word_lower');
                const request = index.get(lowerWord);

                request.onsuccess = (event) => {
                    const result = event.target.result;
                    
                    // Add to memory cache
                    if (result) {
                        this.addToCache(lowerWord, result);
                    }
                    
                    resolve(result || null);
                };

                request.onerror = () => {
                    console.error('Error querying word:', word);
                    resolve(null);
                };
            } catch (error) {
                console.error('Error in queryWord:', error);
                resolve(null);
            }
        });
    }

    /**
     * Query multiple words in a batch (optimized for performance)
     */
    async queryWordsBatch(words) {
        if (!this.isInitialized) {
            return [];
        }

        const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];
        const results = [];
        const toQuery = [];

        // Check cache first
        for (const word of uniqueWords) {
            if (this.memoryCache.has(word)) {
                this.stats.cacheHits++;
                results.push({ word, data: this.memoryCache.get(word) });
            } else {
                toQuery.push(word);
            }
        }

        // Query remaining words from IndexedDB
        if (toQuery.length > 0) {
            this.stats.cacheMisses += toQuery.length;
            
            const transaction = this.db.transaction(['words'], 'readonly');
            const store = transaction.objectStore('words');
            const index = store.index('word_lower');

            const promises = toQuery.map(word => {
                return new Promise((resolve) => {
                    const request = index.get(word);
                    request.onsuccess = (event) => {
                        const data = event.target.result;
                        if (data) {
                            this.addToCache(word, data);
                            resolve({ word, data });
                        } else {
                            resolve({ word, data: null });
                        }
                    };
                    request.onerror = () => resolve({ word, data: null });
                });
            });

            const queryResults = await Promise.all(promises);
            results.push(...queryResults);
        }

        return results;
    }

    /**
     * Add word to memory cache (LRU strategy)
     */
    addToCache(word, data) {
        // If cache is full, remove oldest entry
        if (this.memoryCache.size >= this.maxCacheSize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
        this.memoryCache.set(word, data);
    }

    /**
     * Clear memory cache
     */
    clearCache() {
        this.memoryCache.clear();
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            totalQueries: 0
        };
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            ...this.stats,
            cacheSize: this.memoryCache.size,
            hitRate: this.stats.totalQueries > 0 
                ? (this.stats.cacheHits / this.stats.totalQueries * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Set metadata
     */
    async setMetadata(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get metadata
     */
    async getMetadata(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.get(key);
            
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = () => resolve(null);
        });
    }

    /**
     * Check if data is imported
     */
    async isDataImported() {
        const metadata = await this.getMetadata('importComplete');
        return metadata && metadata.value === true;
    }

    /**
     * Clear all data
     */
    async clearData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words', 'metadata'], 'readwrite');
            
            transaction.objectStore('words').clear();
            transaction.objectStore('metadata').clear();
            
            transaction.oncomplete = () => {
                this.clearCache();
                console.log('✅ DirectDataStorage cleared');
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Close database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
        this.clearCache();
    }
}
