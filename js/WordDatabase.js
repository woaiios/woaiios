/**
 * WordDatabase Module
 * Handles ECDICT SQLite database loading and word analysis
 * Using ECDICT database with 760,000+ words
 * Implements progressive loading for faster initial load times
 * Now with DirectDataStorage for optimized lookups
 */
import { ProgressiveDatabaseLoader } from './ProgressiveDatabaseLoader.js';
import { DirectDataStorage } from './DirectDataStorage.js';

export class WordDatabase {
    constructor() {
        this.db = null;
        this.isLoaded = false;
        this.queryCache = new Map(); // Cache for frequently queried words
        this.SQL = null;
        this.progressiveLoader = null;
        this.progressCallback = null;
        this.directStorage = null;
        this.useDirectStorage = true; // Use optimized direct storage by default
    }

    /**
     * Set progress callback
     * @param {Function} callback - Progress callback function
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Initialize database with ECDICT data
     * Uses DirectDataStorage for optimized lookups if available
     * Falls back to progressive loading with SQL if needed
     * @returns {Promise<boolean>} Loading status
     */
    async initialize() {
        try {
            // Try to use DirectDataStorage first (faster)
            if (this.useDirectStorage) {
                console.log('🚀 Initializing DirectDataStorage for optimized lookups...');
                this.directStorage = new DirectDataStorage();
                await this.directStorage.initialize();
                
                const isImported = await this.directStorage.isDataImported();
                
                if (isImported) {
                    console.log('✅ DirectDataStorage ready with pre-imported data');
                    this.isLoaded = true;
                    return true;
                } else {
                    console.log('⚠️ Data not yet imported to DirectDataStorage, will import after loading SQL database');
                }
            }
            
            // Load SQL database (needed for first-time import or fallback)
            console.log('Initializing sql.js...');
            
            // Dynamically import sql.js
            // In development, Vite requires loading via script tag due to module resolution
            let initSqlJs;
            if (import.meta.env.DEV) {
                // Development: Load via script tag to bypass Vite's module system
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = '/node_modules/sql.js/dist/sql-wasm.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                initSqlJs = window.initSqlJs;
            } else {
                // Production: Use standard ES module import
                const sqlModule = await import('sql.js/dist/sql-wasm.js');
                initSqlJs = sqlModule.default;
            }
            
            // Initialize sql.js with the wasm file
            this.SQL = await initSqlJs({
                locateFile: file => {
                    // In development, the wasm file is in node_modules
                    // In production, it should be in the assets folder
                    if (import.meta.env.DEV) {
                        return `/node_modules/sql.js/dist/${file}`;
                    }
                    return `${import.meta.env.BASE_URL}assets/${file}`;
                }
            });
            
            console.log('🚀 Using progressive database loading...');
            
            // Create progressive loader
            this.progressiveLoader = new ProgressiveDatabaseLoader(this.SQL);
            
            // Register event listeners
            this.progressiveLoader.on('progress', (data) => {
                if (this.progressCallback) {
                    this.progressCallback(data);
                }
            });
            
            this.progressiveLoader.on('chunkLoaded', (data) => {
                console.log(`✅ Chunk ${data.chunkNumber} loaded (${data.percentage.toFixed(1)}% complete)`);
            });
            
            this.progressiveLoader.on('complete', async (data) => {
                console.log(`✨ All database chunks loaded! Total: ${data.totalWords.toLocaleString()} words`);
                
                // Import to DirectDataStorage if not already done
                if (this.useDirectStorage && this.directStorage) {
                    const isImported = await this.directStorage.isDataImported();
                    if (!isImported) {
                        console.log('🔄 Starting one-time import to DirectDataStorage for future performance...');
                        try {
                            await this.directStorage.importFromDatabase(this.db, (progress) => {
                                console.log(`📥 Import progress: ${progress.percentage.toFixed(1)}%`);
                            });
                            console.log('✅ Import to DirectDataStorage completed!');
                        } catch (error) {
                            console.warn('⚠️ Failed to import to DirectDataStorage, will continue with SQL:', error);
                        }
                    }
                }
            });
            
            this.progressiveLoader.on('error', (error) => {
                console.error('Progressive loader error:', error);
            });
            
            // Initialize loader
            await this.progressiveLoader.initialize();
            
            // Load first 3 chunks (high-frequency words) immediately
            // This allows the app to work quickly with most common words
            await this.progressiveLoader.loadPriorityChunks(3);
            
            // Get database reference
            this.db = this.progressiveLoader.getDatabase();
            
            // Test query to verify database structure
            const testResult = this.db.exec("SELECT COUNT(*) as count FROM words LIMIT 1");
            if (testResult.length > 0) {
                const wordCount = testResult[0].values[0][0];
                console.log(`ECDICT database ready with ${wordCount.toLocaleString()} words (loading more in background...)`);
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
     * Query word information from database
     * Uses DirectDataStorage if available, falls back to SQL
     * @param {string} word - Word to query
     * @returns {Promise<Object|null>|Object|null} Word information or null
     */
    queryWord(word) {
        // If using DirectDataStorage and it's ready, use async query
        if (this.useDirectStorage && this.directStorage && this.directStorage.isInitialized) {
            // Return a promise for async operation
            return this.directStorage.queryWord(word);
        }
        
        // Fallback to SQL query (synchronous)
        if (!this.isLoaded || !this.db) {
            return null;
        }

        const lowerWord = word.toLowerCase();
        
        // Check cache first
        if (this.queryCache.has(lowerWord)) {
            return this.queryCache.get(lowerWord);
        }

        try {
            const result = this.db.exec(
                `SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail 
                 FROM words 
                 WHERE LOWER(word) = ?
                 LIMIT 1`,
                [lowerWord]
            );

            if (result.length > 0 && result[0].values.length > 0) {
                const row = result[0].values[0];
                const wordInfo = {
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
                
                // Cache the result
                this.queryCache.set(lowerWord, wordInfo);
                
                // Limit cache size
                if (this.queryCache.size > 10000) {
                    const firstKey = this.queryCache.keys().next().value;
                    this.queryCache.delete(firstKey);
                }
                
                return wordInfo;
            }
            
            return null;
        } catch (error) {
            console.error('Error querying word:', word, error);
            return null;
        }
    }

    /**
     * Query multiple words in batch for better performance
     * @param {Array<string>} words - Array of words to query
     * @returns {Promise<Array<Object>>} Array of word information objects
     */
    async queryWordsBatch(words) {
        // If using DirectDataStorage, use its optimized batch query
        if (this.useDirectStorage && this.directStorage && this.directStorage.isInitialized) {
            const results = await this.directStorage.queryWordsBatch(words);
            return results.map(r => r.data);
        }
        
        // Fallback to SQL batch query
        if (!this.isLoaded || !this.db) {
            return [];
        }
        
        const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];
        const results = [];
        
        for (const word of uniqueWords) {
            const wordInfo = this.queryWord(word);
            if (wordInfo) {
                // Handle both sync and async results
                if (wordInfo instanceof Promise) {
                    results.push(await wordInfo);
                } else {
                    results.push(wordInfo);
                }
            }
        }
        
        return results;
    }

    /**
     * Parse exchange field to get word forms
     * @param {string} exchange - Exchange field from database
     * @returns {Object} Word forms (past, done, ing, third, plural, comparative, superlative, lemma)
     */
    parseExchange(exchange) {
        const forms = {
            p: null,      // past tense (did)
            d: null,      // past participle (done)
            i: null,      // present participle (doing)
            '3': null,    // third person singular (does)
            r: null,      // comparative (-er)
            t: null,      // superlative (-est)
            s: null,      // plural
            '0': null,    // lemma
            '1': null     // lemma variation form
        };

        if (!exchange) return forms;

        const pairs = exchange.split('/');
        for (const pair of pairs) {
            const [type, value] = pair.split(':');
            if (type && value) {
                forms[type] = value;
            }
        }

        return forms;
    }

    /**
     * Get word difficulty level based on ECDICT metadata
     * @param {string} word - Word to analyze
     * @returns {Promise<Object>} Difficulty information
     */
    async getWordDifficulty(word) {
        let wordInfo = await this.queryWord(word);
        
        // If word not found, try to find by lemma (base form)
        if (!wordInfo) {
            wordInfo = await this.findByLemma(word);
        }
        
        // If still not found in database, treat as common word (don't highlight)
        if (!wordInfo) {
            return {
                level: 'common',
                score: 0,
                className: 'common',
                info: null
            };
        }

        // Priority-based difficulty determination:
        // 1. Oxford 3000 core words - most important
        // 2. Collins stars (1-5)
        // 3. Tag (exam levels)
        // 4. Word frequency (BNC and modern corpus)

        let level = 'expert';
        let score = 100;
        const tag = wordInfo.tag || '';
        let hasMetadata = false;

        // Oxford 3000 core vocabulary
        if (wordInfo.oxford === 1) {
            level = 'common';
            score = 0;
            hasMetadata = true;
        }
        // Collins 5 stars
        else if (wordInfo.collins >= 5) {
            level = 'common';
            score = 10;
            hasMetadata = true;
        }
        // Collins 4 stars or common exam tags
        else if (wordInfo.collins >= 4 || tag.includes('zk') || tag.includes('gk') || tag.includes('cet4')) {
            level = 'beginner';
            score = 25;
            hasMetadata = true;
        }
        // Collins 3 stars or CET6
        else if (wordInfo.collins >= 3 || tag.includes('cet6')) {
            level = 'intermediate';
            score = 50;
            hasMetadata = true;
        }
        // Collins 1-2 stars or IELTS/TOEFL
        else if (wordInfo.collins >= 1 || tag.includes('ielts') || tag.includes('toefl')) {
            level = 'advanced';
            score = 75;
            hasMetadata = true;
        }
        // High frequency words (BNC < 20000)
        else if (wordInfo.bnc > 0 && wordInfo.bnc < 20000) {
            level = 'common';
            score = 15;
            hasMetadata = true;
        }
        // Medium frequency (BNC < 50000)
        else if (wordInfo.bnc > 0 && wordInfo.bnc < 50000) {
            level = 'beginner';
            score = 30;
            hasMetadata = true;
        }
        // Lower frequency
        else if (wordInfo.bnc > 0 && wordInfo.bnc < 100000) {
            level = 'intermediate';
            score = 55;
            hasMetadata = true;
        }

        // If no metadata found for this word, try to get difficulty from base form
        if (!hasMetadata && wordInfo.exchange) {
            const forms = this.parseExchange(wordInfo.exchange);
            // Check if this word has a lemma (base form)
            // forms['0'] is the primary lemma, forms['1'] is alternative lemma
            const lemma = forms['0'] || forms['1'];
            if (lemma && lemma.toLowerCase() !== word.toLowerCase()) {
                // Prevent infinite recursion by checking if lemma is different from current word
                const lemmaInfo = await this.queryWord(lemma);
                if (lemmaInfo) {
                    // Recursively get difficulty of base form
                    const lemmaDifficulty = await this.getWordDifficulty(lemma);
                    return lemmaDifficulty;
                }
            }
        }

        return {
            level: level,
            score: score,
            className: level,
            info: wordInfo
        };
    }

    /**
     * Find word by lemma (base form)
     * @param {string} word - Inflected word form
     * @returns {Promise<Object|null>} Base word information
     */
    async findByLemma(word) {
        // Use DirectDataStorage if available (not yet implemented for lemma search)
        // For now, fallback to SQL for this complex query
        
        if (!this.isLoaded || !this.db) {
            return null;
        }

        try {
            // Search for words where this word appears in the exchange field
            const result = this.db.exec(
                `SELECT word, exchange 
                 FROM words 
                 WHERE exchange LIKE ? 
                 LIMIT 10`,
                [`%${word}%`]
            );

            if (result.length > 0 && result[0].values.length > 0) {
                // Find the exact match in exchange field
                for (const row of result[0].values) {
                    const baseWord = row[0];
                    const exchange = row[1];
                    const forms = this.parseExchange(exchange);
                    
                    // Check if any form matches our word
                    for (const formValue of Object.values(forms)) {
                        if (formValue && formValue.toLowerCase() === word.toLowerCase()) {
                            return await this.queryWord(baseWord);
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
     * Fuzzy match words using strip-word field
     * @param {string} word - Word to match
     * @param {number} limit - Maximum results
     * @returns {Array} Matching words
     */
    fuzzyMatch(word, limit = 10) {
        if (!this.isLoaded || !this.db) {
            return [];
        }

        try {
            const lowerWord = word.toLowerCase();
            
            const result = this.db.exec(
                `SELECT word, phonetic, translation 
                 FROM words 
                 WHERE LOWER(word) LIKE ? 
                 LIMIT ?`,
                [`${lowerWord}%`, limit]
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
     * @returns {boolean} Loading status
     */
    isDatabaseLoaded() {
        return this.isLoaded;
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isLoaded = false;
        }
    }
}
