/**
 * WordDatabase Module
 * Handles ECDICT SQLite database loading and word analysis
 * Using ECDICT database with 760,000+ words
 */
export class WordDatabase {
    constructor() {
        this.db = null;
        this.isLoaded = false;
        this.queryCache = new Map(); // Cache for frequently queried words
        this.SQL = null;
    }

    /**
     * Initialize SQLite database with ECDICT data
     * @returns {Promise<boolean>} Loading status
     */
    async initialize() {
        try {
            console.log('Initializing sql.js...');
            
            // Dynamically import sql.js
            const initSqlJs = (await import('sql.js/dist/sql-wasm.js')).default;
            
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
            
            console.log('Loading ECDICT database (stardict.db)...');
            
            // Fetch the database file
            const dbPath = import.meta.env.DEV 
                ? '/stardict.db' 
                : `${import.meta.env.BASE_URL}stardict.db`;
            
            console.log(`Fetching database from: ${dbPath}`);
            const response = await fetch(dbPath);
            if (!response.ok) {
                throw new Error(`Failed to load database: ${response.status} ${response.statusText}`);
            }
            
            // Get the database as an array buffer
            const buffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);
            
            console.log(`Database file loaded, size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
            
            // Create the database
            this.db = new this.SQL.Database(uint8Array);
            
            // Test query to verify database structure
            const testResult = this.db.exec("SELECT COUNT(*) as count FROM words LIMIT 1");
            if (testResult.length > 0) {
                const wordCount = testResult[0].values[0][0];
                console.log(`ECDICT database loaded successfully with ${wordCount.toLocaleString()} words`);
            }
            
            // Create indexes for better performance if they don't exist
            try {
                this.db.exec(`
                    CREATE INDEX IF NOT EXISTS idx_word ON words(word);
                `);
                console.log('Database indexes created');
            } catch (e) {
                console.log('Indexes already exist or cannot be created:', e.message);
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
     * @param {string} word - Word to query
     * @returns {Object|null} Word information or null
     */
    queryWord(word) {
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
     * @returns {Object} Difficulty information
     */
    getWordDifficulty(word) {
        const wordInfo = this.queryWord(word);
        
        // If word not found in database, treat as common word (don't highlight)
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

        // Oxford 3000 core vocabulary
        if (wordInfo.oxford === 1) {
            level = 'common';
            score = 0;
        }
        // Collins 5 stars
        else if (wordInfo.collins >= 5) {
            level = 'common';
            score = 10;
        }
        // Collins 4 stars or common exam tags
        else if (wordInfo.collins >= 4 || tag.includes('zk') || tag.includes('gk') || tag.includes('cet4')) {
            level = 'beginner';
            score = 25;
        }
        // Collins 3 stars or CET6
        else if (wordInfo.collins >= 3 || tag.includes('cet6')) {
            level = 'intermediate';
            score = 50;
        }
        // Collins 1-2 stars or IELTS/TOEFL
        else if (wordInfo.collins >= 1 || tag.includes('ielts') || tag.includes('toefl')) {
            level = 'advanced';
            score = 75;
        }
        // High frequency words (BNC < 20000)
        else if (wordInfo.bnc > 0 && wordInfo.bnc < 20000) {
            level = 'common';
            score = 15;
        }
        // Medium frequency (BNC < 50000)
        else if (wordInfo.bnc > 0 && wordInfo.bnc < 50000) {
            level = 'beginner';
            score = 30;
        }
        // Lower frequency
        else if (wordInfo.bnc > 0 && wordInfo.bnc < 100000) {
            level = 'intermediate';
            score = 55;
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
     * @returns {Object|null} Base word information
     */
    findByLemma(word) {
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
