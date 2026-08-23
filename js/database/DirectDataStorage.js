/**
 * DirectDataStorage Module (Refactored)
 * Main data access layer using IndexedDB for fast queries
 * 
 * Architecture:
 * - This is the ONLY data access layer for the application
 * - Uses modular components: CacheManager, IndexedDBAdapter, WordQueryService
 * - External code should NEVER access WordDatabase directly
 */
import { WordDatabase } from './WordDatabase.js';
import { CacheManager } from './CacheManager.js';
import { IndexedDBAdapter } from './IndexedDBAdapter.js';
import { WordQueryService } from './WordQueryService.js';

export class DirectDataStorage {
    constructor() {
        // Components
        this.cache = new CacheManager(10000);
        this.indexedDB = new IndexedDBAdapter('WordDiscovererDirectDB', 1);
        this.queryService = null;
        
        // Internal WordDatabase - PRIVATE
        this._wordDatabase = new WordDatabase();
        
        // State
        this.isInitialized = false;
        this.progressCallback = null;
    }

    /**
     * Set progress callback
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
        this._wordDatabase.setProgressCallback(callback);
    }

    /**
     * Initialize storage system
     */
    async initialize() {
        // Initialize IndexedDB
        await this.indexedDB.initialize();
        
        // Create query service with IndexedDB adapter and cache
        this.queryService = new WordQueryService(this.indexedDB, this.cache);
        
        // Check if data already imported
        const isImported = await this.isDataImported();
        
        if (!isImported) {
            console.log('⚠️ Starting data import from JSON chunks...');
            
            // Set up background import listeners FIRST (before loading any chunks)
            this._setupBackgroundImportListeners();
            
            // Initialize and load first chunk (data will be auto-imported via events)
            await this._wordDatabase.initialize();
            
            // Mark as ready after first chunk
            this.isInitialized = true;
            console.log('✅ DirectDataStorage ready (first chunk auto-imported via events)');
            
        } else {
            console.log('✅ DirectDataStorage ready (data already imported)');
            this.isInitialized = true;
        }
        
        return true;
    }

    /**
     * Setup background import listeners
     * @private
     */
    async _setupBackgroundImportListeners() {
        console.log('🔄 Setting up background chunk import listeners...');
        
        // Import NotificationManager dynamically to avoid circular dependency
        const { NotificationManager } = await import('../modules/NotificationManager.js');
        
        // Set up listener for new chunk loads and import them.
        // NOTE: completion is tracked HERE (after actual IndexedDB inserts),
        // not on the loader's 'complete' event, which fires when the worker
        // has PARSED chunks — potentially long before inserts finish.
        if (this._wordDatabase.progressiveLoader) {
            console.log('✅ Chunk load listeners registered');
            let importedChunks = 0;
            this._wordDatabase.progressiveLoader.on('chunkLoaded', async (data) => {
                console.log(`🔔 chunkLoaded event received: chunk ${data.chunkNumber}`);

                // Check if chunk data is provided
                if (!data.chunkWords || data.chunkWords.length === 0) {
                    console.warn(`⚠️ No chunk data for chunk ${data.chunkNumber}`);
                    return;
                }

                const rows = data.chunkWords;
                console.log(`📥 Importing chunk ${data.chunkNumber}: ${rows.length.toLocaleString()} words...`);

                const startTime = Date.now();

                // Insert entire chunk in one batch
                await this.indexedDB.insertWordsBatch(rows);

                const duration = Date.now() - startTime;
                console.log(`✅ Chunk ${data.chunkNumber} imported in ${(duration/1000).toFixed(2)}s`);

                importedChunks += 1;

                // Show notification after chunk import completed
                const loaderMeta = this._wordDatabase.progressiveLoader.metadata;
                NotificationManager.show(
                    `📚 Chunk ${data.chunkNumber}/${loaderMeta.totalChunks} loaded (${rows.length.toLocaleString()} words)`,
                    'info'
                );

                // Mark import complete only when every chunk is physically stored
                if (importedChunks >= loaderMeta.totalChunks) {
                    await this._markImportComplete(loaderMeta.totalWords);
                    NotificationManager.show(
                        `✨ Dictionary ready! ${loaderMeta.totalWords.toLocaleString()} words available.`,
                        'success'
                    );
                    console.log('✅ All chunks imported to IndexedDB');
                }
            });
        } else {
            console.warn('⚠️ Progressive loader not available');
        }
    }

    /**
     * Continue importing remaining chunks in background (DEPRECATED - listeners handle this now)
     * @private
     */
    async _importRemainingChunksInBackground() {
        // This method is no longer needed as listeners are set up before loading starts
        console.log('ℹ️ Background import listeners already configured');
    }

    /**
     * Import rows to IndexedDB
     * @private
     */
    async _importRows(rows, totalRows, showProgress = true) {
        const BATCH_SIZE = 1000;
        const YIELD_INTERVAL = 3;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
                word: row[0],
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
            }));

            await this.indexedDB.insertWordsBatch(batch);

            const imported = Math.min(i + BATCH_SIZE, totalRows);
            
            // Progress callback
            if (showProgress && this.progressCallback) {
                this.progressCallback({
                    imported,
                    total: totalRows,
                    percentage: (imported / totalRows) * 100,
                    message: `Importing: ${imported}/${totalRows}`
                });
            }

            // Log progress
            if (showProgress && (imported % 10000 === 0 || imported === totalRows)) {
                console.log(`📥 Progress: ${imported.toLocaleString()}/${totalRows.toLocaleString()} (${((imported/totalRows)*100).toFixed(1)}%)`);
            }
            
            // Yield to main thread
            if (i % (BATCH_SIZE * YIELD_INTERVAL) === 0 && i + BATCH_SIZE < rows.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    /**
     * Mark import as complete
     * @private
     */
    async _markImportComplete(totalWords) {
        await this.indexedDB.setMetadata('importComplete', true);
        await this.indexedDB.setMetadata('importDate', new Date().toISOString());
        await this.indexedDB.setMetadata('totalWords', totalWords);
    }

    /**
     * Query single word
     */
    async queryWord(word) {
        if (!this.isInitialized) return null;
        return await this.queryService.queryWord(word);
    }

    /**
     * Query multiple words in batch
     */
    async queryWordsBatch(words) {
        if (!this.isInitialized) return [];
        return await this.queryService.queryWordsBatch(words);
    }

    /**
     * Get word difficulty
     */
    async getWordDifficulty(word) {
        return await this.queryService.getWordDifficulty(word);
    }

    /**
     * Parse exchange field
     */
    parseExchange(exchange) {
        return this.queryService.parseExchange(exchange);
    }

    /**
     * Delegate methods to WordDatabase
     */
    async findByLemma(word) {
        // Refactored WordDatabase may not implement lemma lookup — degrade gracefully
        if (typeof this._wordDatabase?.findByLemma === 'function') {
            return await this._wordDatabase.findByLemma(word);
        }
        return null;
    }

    async fuzzyMatch(word, limit = 10) {
        if (typeof this._wordDatabase?.fuzzyMatch === 'function') {
            return this._wordDatabase.fuzzyMatch(word, limit);
        }
        return [];
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * Check if data is imported
     */
    async isDataImported() {
        const result = await this.indexedDB.getMetadata('importComplete');
        return result === true;
    }

    /**
     * Clear all data
     */
    async clearData() {
        await this.indexedDB.clearAll();
        this.cache.clear();
        console.log('✅ DirectDataStorage cleared');
    }

    /**
     * Close database
     */
    close() {
        this.indexedDB.close();
        this.cache.clear();
        this.isInitialized = false;
        
        if (this._wordDatabase) {
            this._wordDatabase.close();
        }
    }

    /**
     * Check if database is loaded
     */
    isDatabaseLoaded() {
        return this.isInitialized && this.queryService !== null;
    }
}
