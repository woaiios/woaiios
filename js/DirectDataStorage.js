/**
 * DirectDataStorage Module
 * Stores word data directly in IndexedDB for faster lookups
 * Optimized for querying 300 words in under 50ms
 * 
 * Architecture:
 * - This is the ONLY data access layer for the application
 * - Owns and manages WordDatabase instance internally
 * - External code should NEVER access WordDatabase directly
 */
import { WordDatabase } from './WordDatabase.js';

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
        
        // Internal WordDatabase instance - PRIVATE, do not expose
        this._wordDatabase = new WordDatabase();
        this.progressCallback = null;
    }

    /**
     * Set progress callback for database initialization
     * @param {Function} callback - Progress callback function
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
        this._wordDatabase.setProgressCallback(callback);
    }

    /**
     * Initialize DirectDataStorage and internal WordDatabase
     * This is the main entry point for data layer initialization
     */
    async initialize() {
        // Initialize IndexedDB for fast queries
        await this._initializeIndexedDB();
        
        // Check if we have data in IndexedDB
        const isImported = await this.isDataImported();
        
        if (!isImported) {
            console.log('⚠️ Data not yet imported to DirectDataStorage, starting import...');
            
            // Only initialize WordDatabase if we need to import data
            await this._wordDatabase.initialize();
            
            // Import all data from the loaded SQL database
            await this._importFromCurrentDatabase();
        } else {
            console.log('✅ DirectDataStorage ready with pre-imported data (skipping SQL database download)');
        }
        
        return true;
    }

    /**
     * Import data from the currently loaded SQL database
     * @private
     */
    async _importFromCurrentDatabase() {
        const sqlDB = this._wordDatabase.db;
        
        if (!sqlDB) {
            console.error('❌ WordDatabase not initialized');
            return false;
        }

        console.log('🔄 Starting data import from SQL database to IndexedDB...');
        const startTime = Date.now();
        
        try {
            const result = sqlDB.exec(`
                SELECT word, phonetic, definition, translation, pos, collins, oxford, 
                       tag, bnc, frq, exchange, detail
                FROM words
            `);

            if (result.length === 0 || result[0].values.length === 0) {
                console.log('⚠️ No data to import');
                return true;
            }

            const rows = result[0].values;
            const totalRows = rows.length;
            console.log(`📊 Importing ${totalRows.toLocaleString()} words to IndexedDB...`);

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
                        detail: row[11] || ''
                    };
                    
                    store.put(wordData);
                }

                await new Promise((resolve, reject) => {
                    transaction.oncomplete = resolve;
                    transaction.onerror = () => reject(transaction.error);
                });

                importedCount += batch.length;
                
                if (this.progressCallback) {
                    this.progressCallback({
                        imported: importedCount,
                        total: totalRows,
                        percentage: (importedCount / totalRows) * 100,
                        message: `Importing to IndexedDB: ${importedCount}/${totalRows}`
                    });
                }

                if (importedCount % 10000 === 0 || importedCount === totalRows) {
                    console.log(`📥 Import progress: ${importedCount.toLocaleString()}/${totalRows.toLocaleString()} words (${((importedCount/totalRows)*100).toFixed(1)}%)`);
                }
                
                // Yield to main thread every 3 batches
                if (i % (batchSize * 3) === 0 && i + batchSize < rows.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Mark import as complete
            await this.markImportComplete(totalRows);

            const duration = Date.now() - startTime;
            console.log(`✅ Import completed in ${(duration/1000).toFixed(2)}s`);
            console.log(`📊 Total words imported: ${importedCount.toLocaleString()}`);

            return true;
        } catch (error) {
            console.error(`❌ Error importing data:`, error);
            throw error;
        }
    }

    /**
     * Initialize IndexedDB for direct data storage
     * @private
     */
    async _initializeIndexedDB() {
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


    async markImportComplete(totalWords) {
        await this.setMetadata('importComplete', true);
        await this.setMetadata('importDate', new Date().toISOString());
        await this.setMetadata('totalWords', totalWords);
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
     * Get word difficulty level
     * Delegates to internal WordDatabase
     * @param {string} word - Word to analyze
     * @returns {Promise<Object>} Difficulty information
     */
    async getWordDifficulty(word) {
        return await this._wordDatabase.getWordDifficulty(word);
    }

    /**
     * Parse exchange field to get word forms
     * @param {string} exchange - Exchange field from database
     * @returns {Object} Word forms
     */
    parseExchange(exchange) {
        return this._wordDatabase.parseExchange(exchange);
    }

    /**
     * Find word by lemma (base form)
     * @param {string} word - Inflected word form
     * @returns {Promise<Object|null>} Base word information
     */
    async findByLemma(word) {
        return await this._wordDatabase.findByLemma(word);
    }

    /**
     * Fuzzy match words
     * @param {string} word - Word to match
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Matching words
     */
    async fuzzyMatch(word, limit = 10) {
        return this._wordDatabase.fuzzyMatch(word, limit);
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
        
        // Close internal WordDatabase
        if (this._wordDatabase) {
            this._wordDatabase.close();
        }
    }

    /**
     * Check if database is loaded
     * @returns {boolean} Loading status
     */
    isDatabaseLoaded() {
        return this.isInitialized && this._wordDatabase.isDatabaseLoaded();
    }
}
