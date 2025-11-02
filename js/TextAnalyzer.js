/**
 * TextAnalyzer Module (Refactored)
 * Handles text analysis and word processing logic
 * Now using modular components for better maintainability
 */
import { WordTokenizer } from './analyzers/WordTokenizer.js';
import { DifficultyCalculator } from './analyzers/DifficultyCalculator.js';
import { TranslationFormatter } from './analyzers/TranslationFormatter.js';
import { ExchangeParser } from './analyzers/ExchangeParser.js';

export class TextAnalyzer {
    constructor(wordDatabase, translationService) {
        this.wordDatabase = wordDatabase;
        this.translationService = translationService;
        
        // Initialize sub-modules
        this.exchangeParser = new ExchangeParser();
        this.tokenizer = new WordTokenizer();
        this.difficultyCalculator = new DifficultyCalculator();
        this.translationFormatter = new TranslationFormatter(this.exchangeParser);
    }

    /**
     * Extract words from text
     * @param {string} text - Input text
     * @returns {Array<string>} Array of words
     */
    extractWords(text) {
        return this.tokenizer.extractWords(text);
    }

    /**
     * Parse exchange field (delegated to ExchangeParser)
     * @param {string} exchange - Exchange field from database
     * @returns {Object} Word forms
     */
    parseExchange(exchange) {
        return this.exchangeParser.parseExchange(exchange);
    }

    /**
     * Check if word data has difficulty metadata
     * @param {Object} wordInfo - Word information
     * @returns {boolean} True if word has metadata
     */
    hasMetadata(wordInfo) {
        return this.difficultyCalculator.hasMetadata(wordInfo);
    }

    /**
     * Analyze words for difficulty and highlighting
     * @param {Array<string>} words - Array of words to analyze
     * @param {string} difficultyLevel - Current difficulty level setting
     * @param {string} highlightMode - Highlight mode setting
     * @param {Object} vocabulary - User's vocabulary (learning, mastered)
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeWords(words, difficultyLevel, highlightMode, vocabulary) {
        const analysis = {
            totalWords: words.length,
            highlightedWords: [],
            newWords: [],
            difficultyScore: 0,
            wordFrequency: {}
        };

        const { learning: learningWords, mastered: masteredWords } = vocabulary;

        // Count word frequency
        analysis.wordFrequency = this.tokenizer.countWordFrequency(words);

        // Get unique words
        const uniqueWords = this.tokenizer.getUniqueWords(words);
        
        const startTime = performance.now();
        
        // Batch query all unique words
        const wordDataMap = await this.batchQueryWords(uniqueWords);
        
        // First pass: check for words that need lemma lookup
        const lemmasToQuery = this.collectLemmasToQuery(uniqueWords, wordDataMap);
        
        // Batch query lemmas if needed
        if (lemmasToQuery.size > 0) {
            const lemmaDataMap = await this.batchQueryWords(Array.from(lemmasToQuery));
            // Merge lemma data into wordDataMap
            lemmaDataMap.forEach((data, word) => {
                wordDataMap.set(word, data);
            });
        }
        
        // Second pass: calculate difficulty with lemma fallback
        for (const lowerWord of uniqueWords) {
            const originalWord = words.find(word => word.toLowerCase() === lowerWord) || lowerWord;
            
            let wordData = wordDataMap.get(lowerWord);
            let difficultyData = this.getDifficultyData(lowerWord, wordData, wordDataMap);
            
            let difficulty = this.difficultyCalculator.calculateDifficulty(difficultyData, lowerWord);
            
            // Check vocabulary status
            const isMastered = masteredWords.has(lowerWord);
            const isLearning = learningWords.has(lowerWord);
            
            // Words in learning list should be treated as highest difficulty
            if (isLearning) {
                difficulty = {
                    ...this.difficultyCalculator.EXPERT_DIFFICULTY,
                    info: difficulty.info
                };
            }
            
            const isHighlighted = !isMastered && (isLearning || 
                this.difficultyCalculator.shouldHighlight(lowerWord, difficulty, highlightMode, learningWords, difficultyLevel));
            
            if (isHighlighted) {
                analysis.highlightedWords.push({
                    word: originalWord,
                    difficulty: difficulty,
                    frequency: analysis.wordFrequency[lowerWord],
                    translation: this.translationFormatter.formatTranslation(originalWord, wordData),
                    phonetic: wordData?.phonetic || ''
                });
                
                // A word is new only if it's in neither list
                if (!learningWords.has(lowerWord)) {
                    analysis.newWords.push(lowerWord);
                }
            }
            
            analysis.difficultyScore += difficulty.score;
        }

        const endTime = performance.now();
        console.log(`📊 Analyzed ${uniqueWords.length} unique words in ${(endTime - startTime).toFixed(2)}ms`);

        analysis.difficultyScore = uniqueWords.length > 0 
            ? Math.round(analysis.difficultyScore / uniqueWords.length) 
            : 0;
        
        return analysis;
    }

    /**
     * Batch query words from database
     * @param {Array<string>} words - Array of words to query
     * @returns {Promise<Map>} Map of word data
     */
    async batchQueryWords(words) {
        const wordDataMap = new Map();
        
        if (this.wordDatabase.useDirectStorage && 
            this.wordDatabase.directStorage && 
            this.wordDatabase.directStorage.isInitialized) {
            // Use optimized batch query
            const batchResults = await this.wordDatabase.directStorage.queryWordsBatch(words);
            batchResults.forEach(result => {
                if (result.data) {
                    wordDataMap.set(result.word, result.data);
                }
            });
        } else {
            // Fallback to individual queries
            for (const word of words) {
                const data = await this.wordDatabase.queryWord(word);
                if (data) {
                    wordDataMap.set(word, data);
                }
            }
        }
        
        return wordDataMap;
    }

    /**
     * Collect lemmas that need to be queried
     * @param {Array<string>} uniqueWords - Unique words
     * @param {Map} wordDataMap - Map of word data
     * @returns {Set<string>} Set of lemmas to query
     */
    collectLemmasToQuery(uniqueWords, wordDataMap) {
        const lemmasToQuery = new Set();
        
        for (const lowerWord of uniqueWords) {
            const wordData = wordDataMap.get(lowerWord);
            // If word exists but has no metadata, check if it has a lemma
            if (wordData && !this.hasMetadata(wordData) && wordData.exchange) {
                const lemma = this.exchangeParser.getLemma(wordData.exchange);
                if (lemma && lemma.toLowerCase() !== lowerWord) {
                    const lemmaLower = lemma.toLowerCase();
                    // Only query if lemma not already in wordDataMap
                    if (!wordDataMap.has(lemmaLower)) {
                        lemmasToQuery.add(lemmaLower);
                    }
                }
            }
        }
        
        return lemmasToQuery;
    }

    /**
     * Get difficulty data with lemma fallback
     * @param {string} lowerWord - Lowercase word
     * @param {Object} wordData - Word data
     * @param {Map} wordDataMap - Map of word data
     * @returns {Object} Difficulty data
     */
    getDifficultyData(lowerWord, wordData, wordDataMap) {
        let difficultyData = wordData;
        
        // If word has no metadata, try to use its lemma's data
        if (wordData && !this.hasMetadata(wordData) && wordData.exchange) {
            const lemma = this.exchangeParser.getLemma(wordData.exchange);
            if (lemma && lemma.toLowerCase() !== lowerWord) {
                const lemmaData = wordDataMap.get(lemma.toLowerCase());
                if (lemmaData && this.hasMetadata(lemmaData)) {
                    difficultyData = lemmaData;
                }
            }
        }
        
        return difficultyData;
    }

    /**
     * Calculate difficulty from word data (for backward compatibility)
     * @param {Object} wordInfo - Word information
     * @param {string} word - Word being analyzed
     * @returns {Object} Difficulty information
     */
    calculateDifficultyFromData(wordInfo, word) {
        return this.difficultyCalculator.calculateDifficulty(wordInfo, word);
    }

    /**
     * Format translation from word data (for backward compatibility)
     * @param {string} word - Original word
     * @param {Object} wordInfo - Word information
     * @returns {string} Translation HTML
     */
    formatTranslationFromData(word, wordInfo) {
        return this.translationFormatter.formatTranslation(word, wordInfo);
    }

    /**
     * Determine if a word should be highlighted (for backward compatibility)
     * @param {string} word - Word to check
     * @param {Object} difficulty - Difficulty information
     * @param {string} highlightMode - Highlight mode
     * @param {Map} learningWords - Learning words
     * @param {string} userDifficultyLevel - User difficulty level
     * @returns {boolean} True if should highlight
     */
    shouldHighlight(word, difficulty, highlightMode, learningWords, userDifficultyLevel) {
        return this.difficultyCalculator.shouldHighlight(
            word, difficulty, highlightMode, learningWords, userDifficultyLevel
        );
    }

    /**
     * Get translation for a word from ECDICT database
     * @param {string} word - Word to translate
     * @returns {Promise<string>} Translation HTML
     */
    async getTranslation(word) {
        const lowerWord = word.toLowerCase();
        
        // Check cache first
        if (this.translationFormatter.translationCache.has(lowerWord)) {
            return this.translationFormatter.translationCache.get(lowerWord);
        }
        
        if (!this.wordDatabase.isDatabaseLoaded()) {
            return `<div class="word-info"><p>数据库未加载</p></div>`;
        }
        
        // Try to query the word directly
        let wordInfo = await this.wordDatabase.queryWord(lowerWord);
        
        // If not found, try to find by lemma
        if (!wordInfo) {
            wordInfo = await this.wordDatabase.findByLemma(lowerWord);
        }
        
        return this.translationFormatter.formatTranslation(word, wordInfo);
    }

    /**
     * Extract first Chinese translation (delegated to TranslationFormatter)
     * @param {string} translationHtml - Full translation HTML
     * @returns {string} First Chinese word
     */
    extractFirstChineseTranslation(translationHtml) {
        return this.translationFormatter.extractFirstChineseTranslation(translationHtml);
    }

    /**
     * Escape HTML (delegated to TranslationFormatter)
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        return this.translationFormatter.escapeHtml(text);
    }

    /**
     * Escape HTML attribute (delegated to TranslationFormatter)
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtmlAttribute(text) {
        return this.translationFormatter.escapeHtmlAttribute(text);
    }

    /**
     * Process text for display with highlighted words
     * @param {string} originalText - Original text
     * @param {Object} analysis - Analysis results
     * @returns {Promise<string>} Processed HTML text
     */
    async processTextForDisplay(originalText, analysis) {
        const highlightedMap = new Map(
            analysis.highlightedWords.map(item => [item.word.toLowerCase(), item])
        );

        // Split text by word boundaries
        const parts = this.tokenizer.splitTextByWords(originalText);

        // Extract unique words that need translations
        const uniqueWords = [...new Set(parts.filter(part => this.tokenizer.isWord(part)))];
        
        // Batch fetch translations
        const translationMap = new Map();
        
        // Add translations from analysis (for highlighted words)
        for (const item of analysis.highlightedWords) {
            if (item.translation) {
                translationMap.set(item.word.toLowerCase(), item.translation);
            }
        }
        
        // Fetch remaining translations
        const wordsNeedingTranslation = uniqueWords.filter(w => 
            !translationMap.has(w.toLowerCase())
        );
        
        if (wordsNeedingTranslation.length > 0) {
            const batchTranslations = await Promise.all(
                wordsNeedingTranslation.map(word => this.getTranslation(word))
            );
            wordsNeedingTranslation.forEach((word, index) => {
                translationMap.set(word.toLowerCase(), batchTranslations[index]);
            });
        }

        // Process all parts with pre-fetched translations
        const processedParts = parts.map((part) => {
            const lowerCasePart = part.toLowerCase();
            
            if (!this.tokenizer.isWord(lowerCasePart)) {
                return part; // Return delimiters as is
            }

            const highlightedInfo = highlightedMap.get(lowerCasePart);
            const translation = translationMap.get(lowerCasePart) || '';

            // Escape HTML for attributes
            const escapedTranslation = this.escapeHtmlAttribute(translation);

            // Extract Chinese annotation
            let chineseAnnotation = '';
            if (highlightedInfo) {
                chineseAnnotation = this.extractFirstChineseTranslation(translation);
            }
            const escapedChinese = this.escapeHtml(chineseAnnotation);

            // Build container classes
            let containerClasses = 'double-ruby word-span';
            if (highlightedInfo) {
                containerClasses += ` highlight ${highlightedInfo.difficulty.className}`;
            }

            // Get phonetic annotation
            let phoneticAnnotation = '&nbsp;';
            if (highlightedInfo && highlightedInfo.phonetic) {
                phoneticAnnotation = this.escapeHtml(highlightedInfo.phonetic);
            }

            // Get Chinese annotation
            let chineseRt = escapedChinese || '&nbsp;';

            // Build the double-ruby HTML structure
            return `<span class="${containerClasses}" data-word="${part}" data-translation="${escapedTranslation}">` +
                   `<ruby class="over"><rt>${phoneticAnnotation}</rt></ruby>` +
                   `<span class="base">${part}</span>` +
                   `<ruby class="under"><rt>${chineseRt}</rt></ruby>` +
                   `</span>`;
        });
        
        return processedParts.join('');
    }

    /**
     * Calculate text complexity metrics
     * @param {Array<string>} words - Array of words
     * @param {string} difficultyLevel - Difficulty level setting
     * @returns {Object} Complexity metrics
     */
    calculateComplexityMetrics(words, difficultyLevel) {
        const uniqueWords = this.tokenizer.getUniqueWords(words);
        
        const metrics = {
            totalWords: words.length,
            uniqueWords: uniqueWords.length,
            averageWordLength: 0,
            difficultyDistribution: {
                common: 0,
                beginner: 0,
                intermediate: 0,
                advanced: 0,
                expert: 0
            }
        };

        // Calculate average word length
        const totalLength = words.reduce((sum, word) => sum + word.length, 0);
        metrics.averageWordLength = Math.round(totalLength / words.length * 10) / 10;

        // Calculate difficulty distribution
        uniqueWords.forEach(word => {
            const difficulty = this.wordDatabase.getWordDifficulty(word, difficultyLevel);
            metrics.difficultyDistribution[difficulty.level]++;
        });

        return metrics;
    }
    
    /**
     * Clear translation cache
     */
    clearTranslationCache() {
        this.translationFormatter.clearCache();
    }
    
    /**
     * Get translation cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return this.translationFormatter.getCacheStats();
    }
}
