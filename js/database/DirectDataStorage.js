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
            console.log('⚠️ Starting data import from SQL database...');
            await this._wordDatabase.initialize();
            await this._importFromSQLDatabase();
        } else {
            console.log('✅ DirectDataStorage ready (data already imported)');
        }
        
        this.isInitialized = true;
        return true;
    }

    /**
     * Import data from SQL database to IndexedDB
     * @private
     */
    async _importFromSQLDatabase() {
        const sqlDB = this._wordDatabase.db;
        
        if (!sqlDB) {
            throw new Error('WordDatabase not initialized');
        }

        console.log('🔄 Importing data to IndexedDB...');
        const startTime = Date.now();
        
        const result = sqlDB.exec(`
            SELECT word, phonetic, definition, translation, pos, collins, oxford, 
                   tag, bnc, frq, exchange, detail
            FROM words
        `);

        if (result.length === 0 || result[0].values.length === 0) {
            console.log('⚠️ No data to import');
            return;
        }

        const rows = result[0].values;
        const totalRows = rows.length;
        console.log(`📊 Importing ${totalRows.toLocaleString()} words...`);

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
            if (this.progressCallback) {
                this.progressCallback({
                    imported,
                    total: totalRows,
                    percentage: (imported / totalRows) * 100,
                    message: `Importing: ${imported}/${totalRows}`
                });
            }

            // Log progress
            if (imported % 10000 === 0 || imported === totalRows) {
                console.log(`📥 Progress: ${imported.toLocaleString()}/${totalRows.toLocaleString()} (${((imported/totalRows)*100).toFixed(1)}%)`);
            }
            
            // Yield to main thread
            if (i % (BATCH_SIZE * YIELD_INTERVAL) === 0 && i + BATCH_SIZE < rows.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        await this._markImportComplete(totalRows);

        const duration = Date.now() - startTime;
        console.log(`✅ Import completed in ${(duration/1000).toFixed(2)}s`);
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
        return await this._wordDatabase.findByLemma(word);
    }

    async fuzzyMatch(word, limit = 10) {
        return this._wordDatabase.fuzzyMatch(word, limit);
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
        return this.isInitialized && this._wordDatabase.isDatabaseLoaded();
    }
}
