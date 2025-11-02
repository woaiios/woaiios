/**
 * WordDatabase Module (Refactored)
 * Handles ECDICT SQLite database loading
 * 
 * NOTE: This class should ONLY be used internally by DirectDataStorage
 */
import { ProgressiveDatabaseLoader } from '../ProgressiveDatabaseLoader.js';
import { CacheManager } from './CacheManager.js';
import { WordQueryService } from './WordQueryService.js';

/**
 * SQL Database Adapter for WordQueryService
 */
class SQLDatabaseAdapter {
    constructor(db) {
        this.db = db;
    }

    async queryWord(word) {
        if (!this.db) return null;

        const lowerWord = word.toLowerCase();

        try {
            const result = this.db.exec(
                `SELECT word, phonetic, definition, translation, pos, collins, oxford, 
                        tag, bnc, frq, exchange, detail 
                 FROM words 
                 WHERE LOWER(word) = ?
                 LIMIT 1`,
                [lowerWord]
            );

            if (result.length > 0 && result[0].values.length > 0) {
                const row = result[0].values[0];
                return {
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
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error querying word:', word, error);
            return null;
        }
    }

    async queryWordsBatch(words) {
        const results = [];
        for (const word of words) {
            const data = await this.queryWord(word);
            results.push({ word, data });
        }
        return results;
    }
}

export class WordDatabase {
    constructor() {
        this.db = null;
        this.isLoaded = false;
        this.SQL = null;
        this.progressiveLoader = null;
        this.progressCallback = null;
        
        // Query service components
        this.cache = new CacheManager(10000);
        this.queryService = null;
    }

    /**
     * Set progress callback
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Initialize database with progressive loading
     */
    async initialize() {
        try {
            console.log('Initializing sql.js...');
            
            // Load sql.js
            const initSqlJs = await this._loadSqlJs();
            
            this.SQL = await initSqlJs({
                locateFile: file => {
                    if (import.meta.env.DEV) {
                        return `/node_modules/sql.js/dist/${file}`;
                    }
                    return `${import.meta.env.BASE_URL}assets/${file}`;
                }
            });
            
            console.log('🚀 Using progressive database loading...');
            
            // Initialize progressive loader
            this.progressiveLoader = new ProgressiveDatabaseLoader(this.SQL);
            this._registerLoaderEvents();
            
            await this.progressiveLoader.initialize();
            await this.progressiveLoader.loadPriorityChunks(3);
            
            this.db = this.progressiveLoader.getDatabase();
            
            // Initialize query service
            const sqlAdapter = new SQLDatabaseAdapter(this.db);
            this.queryService = new WordQueryService(sqlAdapter, this.cache);
            
            // Verify database
            const testResult = this.db.exec("SELECT COUNT(*) as count FROM words LIMIT 1");
            if (testResult.length > 0) {
                const wordCount = testResult[0].values[0][0];
                console.log(`ECDICT database ready: ${wordCount.toLocaleString()} words`);
            }
            
            this.isLoaded = true;
            return true;
            
        } catch (error) {
            console.error('Error loading ECDICT database:', error);
            this.isLoaded = false;
            return false;
        }
    }

    /**
     * Load sql.js library
     * @private
     */
    async _loadSqlJs() {
        if (import.meta.env.DEV) {
            // Development: Load via script tag
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/node_modules/sql.js/dist/sql-wasm.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            return window.initSqlJs;
        } else {
            // Production: ES module import
            const sqlModule = await import('sql.js/dist/sql-wasm.js');
            return sqlModule.default;
        }
    }

    /**
     * Register progressive loader events
     * @private
     */
    _registerLoaderEvents() {
        this.progressiveLoader.on('progress', (data) => {
            if (this.progressCallback) {
                this.progressCallback(data);
            }
        });
        
        this.progressiveLoader.on('chunkLoaded', (data) => {
            console.log(`✅ Chunk ${data.chunkNumber} loaded (${data.percentage.toFixed(1)}%)`);
        });
        
        this.progressiveLoader.on('complete', (data) => {
            console.log(`✨ Database fully loaded: ${data.totalWords.toLocaleString()} words`);
        });
        
        this.progressiveLoader.on('error', (error) => {
            console.error('Progressive loader error:', error);
        });
    }

    /**
     * Query word using service
     */
    queryWord(word) {
        if (!this.isLoaded || !this.queryService) return null;
        return this.queryService.queryWord(word);
    }

    /**
     * Batch query words
     */
    async queryWordsBatch(words) {
        if (!this.isLoaded || !this.queryService) return [];
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
     * Find word by lemma (base form)
     */
    async findByLemma(word) {
        if (!this.isLoaded || !this.db) return null;

        try {
            const result = this.db.exec(
                `SELECT word, exchange 
                 FROM words 
                 WHERE exchange LIKE ? 
                 LIMIT 10`,
                [`%${word}%`]
            );

            if (result.length > 0 && result[0].values.length > 0) {
                for (const row of result[0].values) {
                    const baseWord = row[0];
                    const exchange = row[1];
                    const forms = this.parseExchange(exchange);
                    
                    for (const formValue of Object.values(forms)) {
                        if (formValue && formValue.toLowerCase() === word.toLowerCase()) {
                            return this.queryWord(baseWord);
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error finding lemma:', error);
            return null;
        }
    }

    /**
     * Fuzzy match words
     */
    fuzzyMatch(word, limit = 10) {
        if (!this.isLoaded || !this.db) return [];

        try {
            const result = this.db.exec(
                `SELECT word, phonetic, translation 
                 FROM words 
                 WHERE LOWER(word) LIKE ? 
                 LIMIT ?`,
                [`${word.toLowerCase()}%`, limit]
            );

            if (result.length > 0 && result[0].values.length > 0) {
                return result[0].values.map(row => ({
                    word: row[0],
                    phonetic: row[1] || '',
                    translation: row[2] || ''
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Error fuzzy matching:', error);
            return [];
        }
    }

    /**
     * Check if database is loaded
     */
    isDatabaseLoaded() {
        return this.isLoaded;
    }

    /**
     * Close database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isLoaded = false;
        }
        this.cache.clear();
    }
}
