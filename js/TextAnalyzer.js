/**
 * TextAnalyzer Module
 * Handles text analysis and word processing logic
 * Now using ECDICT SQLite database
 */
export class TextAnalyzer {
    constructor(wordDatabase, translationService) {
        this.wordDatabase = wordDatabase;
        this.translationService = translationService;
        this.tokenizer = null;
        this.translationCache = new Map(); // Cache formatted translations to avoid repeated HTML generation
        this.maxCacheSize = 5000; // Limit cache size as user requested: "别存太多"
        this.loadTokenizer();
    }

    /**
     * Load tokenizer - now using Intl.Segmenter
     */
    async loadTokenizer() {
        try {
            // Check if Intl.Segmenter is available
            if (Intl.Segmenter) {
                // Create a segmenter for English
                this.tokenizer = new Intl.Segmenter(undefined, { granularity: 'word' });
                console.log('Intl.Segmenter loaded successfully');
            } else {
                throw new Error('Intl.Segmenter not supported in this browser');
            }
        } catch (error) {
            console.warn('Error loading Intl.Segmenter, falling back to simple extraction:', error);
            // Fallback function in case Intl.Segmenter fails
            this.tokenizer = {
                tokenize: (text) => {
                    return text.split(/\s+/).map(token => ({ value: token, tag: 'word' }));
                }
            };
        }
    }

    /**
     * Extract words from text
     * @param {string} text - Input text
     * @returns {Array<string>} Array of words
     */
    extractWords(text) {
        // Use Intl.Segmenter if available
        if (this.tokenizer && this.tokenizer.segment) {
            const segments = this.tokenizer.segment(text);
            return Array.from(segments)
                .filter(segment => segment.isWordLike)
                .map(segment => segment.segment)
                .filter(word => word.length > 1)
                // Only include English words (containing only Latin alphabet characters)
                .filter(word => /^[a-zA-Z]+$/.test(word));
        }
        
        // Fallback to original method
        return text
            .split(/\s+/)
            .filter(word => word.length > 1)
            // Only include English words (containing only Latin alphabet characters)
            .filter(word => /^[a-zA-Z]+$/.test(word));
    }

    /**
     * Analyze words for difficulty and highlighting.
     * @param {Array<string>} words - Array of words to analyze.
     * @param {string} difficultyLevel - Current difficulty level setting.
     * @param {string} highlightMode - Highlight mode setting.
     * @param {Object} vocabulary - User's vocabulary, containing 'learning' and 'mastered' maps.
     * @returns {Promise<Object>} Analysis results.
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

        // Count word frequency using lowercase for counting but preserving original case for display
        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            analysis.wordFrequency[lowerWord] = (analysis.wordFrequency[lowerWord] || 0) + 1;
        });

        // Analyze each unique word (using lowercase for comparison)
        const uniqueWords = [...new Set(words.map(word => word.toLowerCase()))];
        
        // Use batch query for better performance - query all words at once
        const startTime = performance.now();
        
        // Batch query all unique words
        const wordDataMap = new Map();
        if (this.wordDatabase.useDirectStorage && this.wordDatabase.directStorage && this.wordDatabase.directStorage.isInitialized) {
            // Use optimized batch query
            const batchResults = await this.wordDatabase.directStorage.queryWordsBatch(uniqueWords);
            batchResults.forEach(result => {
                if (result.data) {
                    wordDataMap.set(result.word, result.data);
                }
            });
        } else {
            // Fallback to individual queries
            for (const word of uniqueWords) {
                const data = await this.wordDatabase.queryWord(word);
                if (data) {
                    wordDataMap.set(word, data);
                }
            }
        }
        
        // Process each word with the pre-fetched data
        for (const lowerWord of uniqueWords) {
            // Find the original casing of the word for display
            const originalWord = words.find(word => word.toLowerCase() === lowerWord) || lowerWord;
            
            const wordData = wordDataMap.get(lowerWord);
            const difficulty = this.calculateDifficultyFromData(wordData, lowerWord);
            
            // A word is never highlighted if it is in the mastered list.
            const isMastered = masteredWords.has(lowerWord);
            // A word should always be highlighted if it is in the learning list.
            const isLearning = learningWords.has(lowerWord);
            const isHighlighted = !isMastered && (isLearning || this.shouldHighlight(lowerWord, difficulty, highlightMode, learningWords, difficultyLevel));
            
            if (isHighlighted) {
                analysis.highlightedWords.push({
                    word: originalWord, // Use original casing for display
                    difficulty: difficulty,
                    frequency: analysis.wordFrequency[lowerWord],
                    translation: this.formatTranslationFromData(originalWord, wordData)
                });
                
                // A word is new only if it's in neither list.
                if (!learningWords.has(lowerWord)) {
                    analysis.newWords.push(lowerWord);
                }
            }
            
            analysis.difficultyScore += difficulty.score;
        }

        const endTime = performance.now();
        console.log(`📊 Analyzed ${uniqueWords.length} unique words in ${(endTime - startTime).toFixed(2)}ms`);

        analysis.difficultyScore = uniqueWords.length > 0 ? Math.round(analysis.difficultyScore / uniqueWords.length) : 0;
        
        return analysis;
    }

    /**
     * Calculate difficulty from word data (extracted from WordDatabase.getWordDifficulty)
     * @param {Object} wordInfo - Word information
     * @param {string} word - Word being analyzed
     * @returns {Object} Difficulty information
     */
    calculateDifficultyFromData(wordInfo, word) {
        // If still not found in database, treat as common word (don't highlight)
        if (!wordInfo) {
            return {
                level: 'common',
                score: 0,
                className: 'common',
                info: null
            };
        }

        let level = 'expert';
        let score = 100;
        const tag = wordInfo.tag || '';
        let hasMetadata = false;

        // Oxford 3000 core vocabulary
        if (wordInfo.oxford === 1 || wordInfo.oxford === true) {
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

        return {
            level: level,
            score: score,
            className: level,
            info: wordInfo
        };
    }

    /**
     * Format translation from word data (extracted from getTranslation)
     * @param {string} word - Original word
     * @param {Object} wordInfo - Word information
     * @returns {string} Translation HTML
     */
    formatTranslationFromData(word, wordInfo) {
        if (!wordInfo) {
            return `<div class="word-info">
                <h3>${word}</h3>
                <p class="no-translation">未找到释义</p>
            </div>`;
        }

        // Build compact HTML from ECDICT data with collapsible details
        let html = `<div class="word-info ecdict-entry compact">`;
        
        // Word title (always visible)
        html += `<h3 class="word-title">${wordInfo.word}</h3>`;
        
        // Phonetic (always visible - first line)
        if (wordInfo.phonetic) {
            html += `<div class="phonetic-line">/${wordInfo.phonetic}/</div>`;
        }
        
        // Chinese translation (always visible - second line)
        if (wordInfo.translation) {
            html += `<div class="translation-compact">`;
            const lines = wordInfo.translation.split('\\n');
            const firstLine = lines[0] ? this.escapeHtml(lines[0].trim()) : '';
            if (firstLine) {
                html += `<p>${firstLine}</p>`;
            }
            html += `</div>`;
        }
        
        // Collapsible details section (simplified for performance)
        html += `<div class="word-details-toggle" onclick="this.parentElement.classList.toggle('expanded')">`;
        html += `<span class="toggle-icon">▼</span> <span class="toggle-text">更多详情</span>`;
        html += `</div>`;
        
        html += `<div class="word-details-content">`;
        
        // Collins stars and Oxford badge
        if (wordInfo.collins > 0 || wordInfo.oxford) {
            html += `<div class="word-meta">`;
            if (wordInfo.collins > 0) {
                html += `<span class="collins-stars">${'★'.repeat(wordInfo.collins)}</span>`;
            }
            if (wordInfo.oxford) {
                html += `<span class="oxford-badge">Oxford 3000</span>`;
            }
            html += `</div>`;
        }
        
        html += `</div>`; // Close word-details-content
        html += `</div>`; // Close word-info
        
        return html;
    }

    /**
     * Determine if a word should be highlighted based on settings and vocabulary.
     * @param {string} word - Word to check.
     * @param {Object} difficulty - Difficulty information.
     * @param {string} highlightMode - Highlight mode.
     * @param {Map} learningWords - The user's list of words they are learning.
     * @param {string} userDifficultyLevel - The user's selected difficulty threshold.
     * @returns {boolean} True if the word should be highlighted.
     */
    shouldHighlight(word, difficulty, highlightMode, learningWords, userDifficultyLevel) {
        const difficultyOrder = { 'common': 0, 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4, 'unknown': 5 };
        const wordDifficultyIndex = difficultyOrder[difficulty.level];
        const userDifficultyIndex = difficultyOrder[userDifficultyLevel];

        // Determine if the word is considered difficult for the user
        const isDifficultForUser = wordDifficultyIndex > userDifficultyIndex;

        switch (highlightMode) {
            case 'unknown':
                // Highlight difficult words that are not in the learning list.
                return isDifficultForUser && !learningWords.has(word);
            case 'difficult':
                // Highlight all words considered difficult for the user.
                return isDifficultForUser;
            case 'all':
                // Highlight all words that are not marked as mastered.
                return true;
            default:
                return false;
        }
    }

    /**
     * Get translation for a word from ECDICT database
     * Uses cache to avoid repeated queries and HTML generation
     * @param {string} word - Word to translate
     * @returns {Promise<string>} Translation HTML
     */
    async getTranslation(word) {
        const lowerWord = word.toLowerCase();
        
        // Check cache first to avoid repeated queries
        if (this.translationCache.has(lowerWord)) {
            return this.translationCache.get(lowerWord);
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
        
        let html;
        if (!wordInfo) {
            html = `<div class="word-info">
                <h3>${word}</h3>
                <p class="no-translation">未找到释义</p>
            </div>`;
        } else {
            // Build compact HTML from ECDICT data with collapsible details
            html = `<div class="word-info ecdict-entry compact">`;
            
            // Word title (always visible)
            html += `<h3 class="word-title">${wordInfo.word}</h3>`;
            
            // Phonetic (always visible - first line)
            if (wordInfo.phonetic) {
                html += `<div class="phonetic-line">/${wordInfo.phonetic}/</div>`;
            }
            
            // Chinese translation (always visible - second line)
            if (wordInfo.translation) {
                html += `<div class="translation-compact">`;
                const lines = wordInfo.translation.split('\\n');
                const firstLine = lines[0] ? this.escapeHtml(lines[0].trim()) : '';
                if (firstLine) {
                    html += `<p>${firstLine}</p>`;
                }
                html += `</div>`;
            }
            
            // Collapsible details section
            html += `<div class="word-details-toggle" onclick="this.parentElement.classList.toggle('expanded')">`;
            html += `<span class="toggle-icon">▼</span> <span class="toggle-text">更多详情</span>`;
            html += `</div>`;
        
        html += `<div class="word-details-content">`;
        
        // Collins stars and Oxford badge
        if (wordInfo.collins > 0 || wordInfo.oxford) {
            html += `<div class="word-meta">`;
            if (wordInfo.collins > 0) {
                html += `<span class="collins-stars">${'★'.repeat(wordInfo.collins)}</span>`;
            }
            if (wordInfo.oxford) {
                html += `<span class="oxford-badge">Oxford 3000</span>`;
            }
            html += `</div>`;
        }
        
        // Tags (exam levels)
        if (wordInfo.tag) {
            const tags = wordInfo.tag.split(' ').filter(t => t);
            if (tags.length > 0) {
                html += `<div class="word-tags">`;
                const tagNames = {
                    'zk': '中考', 'gk': '高考', 'cet4': 'CET-4', 'cet6': 'CET-6',
                    'ielts': 'IELTS', 'toefl': 'TOEFL', 'gre': 'GRE', 'tem4': 'TEM-4', 'tem8': 'TEM-8'
                };
                tags.forEach(tag => {
                    const tagName = tagNames[tag] || tag;
                    html += `<span class="tag">${tagName}</span>`;
                });
                html += `</div>`;
            }
        }
        
        // Full Chinese translation (if multiple lines)
        if (wordInfo.translation) {
            const lines = wordInfo.translation.split('\\n');
            if (lines.length > 1) {
                html += `<div class="translation">`;
                lines.forEach((line, index) => {
                    if (line.trim() && index > 0) { // Skip first line as it's already shown
                        html += `<p>${this.escapeHtml(line)}</p>`;
                    }
                });
                html += `</div>`;
            }
        }
        
        // English definition
        if (wordInfo.definition) {
            html += `<div class="definition">`;
            html += `<h4>English Definition:</h4>`;
            const lines = wordInfo.definition.split('\\n');
            lines.forEach(line => {
                if (line.trim()) {
                    html += `<p>${this.escapeHtml(line)}</p>`;
                }
            });
            html += `</div>`;
        }
        
        // Word forms (exchange)
        if (wordInfo.exchange) {
            const forms = this.wordDatabase.parseExchange(wordInfo.exchange);
            const formLabels = {
                'p': '过去式', 'd': '过去分词', 'i': '现在分词', '3': '第三人称单数',
                'r': '比较级', 't': '最高级', 's': '复数', '0': '原形'
            };
            
            const validForms = [];
            for (const [key, value] of Object.entries(forms)) {
                if (value && formLabels[key]) {
                    validForms.push(`${formLabels[key]}: ${value}`);
                }
            }
            
            if (validForms.length > 0) {
                html += `<div class="word-forms">`;
                html += `<h4>词形变化:</h4>`;
                html += `<p>${validForms.join(' | ')}</p>`;
                html += `</div>`;
            }
        }
        
        // Frequency information
        if (wordInfo.bnc > 0 || wordInfo.frq > 0) {
            html += `<div class="word-frequency">`;
            if (wordInfo.bnc > 0) {
                html += `<span>BNC词频: ${wordInfo.bnc.toLocaleString()}</span>`;
            }
            if (wordInfo.frq > 0) {
                html += `<span>当代词频: ${wordInfo.frq.toLocaleString()}</span>`;
            }
            html += `</div>`;
        }
        
            html += `</div>`; // Close word-details-content
            html += `</div>`; // Close word-info
        }
        
        // Store in cache for future use (avoid repeated queries)
        this.translationCache.set(lowerWord, html);
        
        // Limit cache size to avoid memory issues (as user requested: "别存太多")
        if (this.translationCache.size > this.maxCacheSize) {
            const firstKey = this.translationCache.keys().next().value;
            this.translationCache.delete(firstKey);
        }
        
        return html;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Process text for display with highlighted words
     * @param {string} originalText - Original text
     * @param {Object} analysis - Analysis results
     * @returns {Promise<string>} Processed HTML text
     */
    async processTextForDisplay(originalText, analysis) {
        const highlightedMap = new Map(analysis.highlightedWords.map(item => [item.word.toLowerCase(), item]));

        // Split the text by word boundaries, keeping the delimiters.
        const parts = originalText.split(/(\b[a-zA-Z-]+\b)/);

        // Extract unique words that need translations
        const uniqueWords = [...new Set(parts.filter(part => /\b[a-zA-Z-]+\b/.test(part)))];
        
        // Batch fetch translations for all unique words
        const translationMap = new Map();
        
        // First, add translations from analysis (for highlighted words)
        for (const item of analysis.highlightedWords) {
            if (item.translation) {
                translationMap.set(item.word.toLowerCase(), item.translation);
            }
        }
        
        // Fetch remaining translations for non-highlighted words
        const wordsNeedingTranslation = uniqueWords.filter(w => !translationMap.has(w.toLowerCase()));
        if (wordsNeedingTranslation.length > 0) {
            const batchTranslations = await Promise.all(
                wordsNeedingTranslation.map(word => this.getTranslation(word))
            );
            wordsNeedingTranslation.forEach((word, index) => {
                translationMap.set(word.toLowerCase(), batchTranslations[index]);
            });
        }

        // Now process all parts with pre-fetched translations
        const processedParts = parts.map((part) => {
            const lowerCasePart = part.toLowerCase();
            // Check if the part is a word and not just a delimiter.
            if (!/\b[a-zA-Z-]+\b/.test(lowerCasePart)) {
                return part; // Return delimiters as is.
            }

            const highlightedInfo = highlightedMap.get(lowerCasePart);
            const translation = translationMap.get(lowerCasePart) || '';
            let classes = 'word-span';

            if (highlightedInfo) {
                classes += ` highlighted-word ${highlightedInfo.difficulty.className}`;
            }

            // Escape HTML for the data attribute
            const escapedTranslation = translation
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            return `<span class="${classes}" data-word="${part}" data-translation="${escapedTranslation}">${part}</span>`;
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
        const uniqueWords = [...new Set(words)];
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
     * Useful when memory usage needs to be reduced
     */
    clearTranslationCache() {
        this.translationCache.clear();
        console.log('🗑️ Translation cache cleared');
    }
    
    /**
     * Get translation cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.translationCache.size,
            maxSize: this.maxCacheSize,
            utilization: `${((this.translationCache.size / this.maxCacheSize) * 100).toFixed(1)}%`
        };
    }
}