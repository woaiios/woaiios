/**
 * TextAnalyzer Module
 * Handles text analysis and word processing logic
 */
export class TextAnalyzer {
    constructor(wordDatabase, translationService) {
        this.wordDatabase = wordDatabase;
        this.translationService = translationService;
    }

    /**
     * Extract words from text
     * @param {string} text - Input text
     * @returns {Array<string>} Array of words
     */
    extractWords(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    /**
     * Analyze words for difficulty and highlighting.
     * @param {Array<string>} words - Array of words to analyze.
     * @param {string} difficultyLevel - Current difficulty level setting.
     * @param {string} highlightMode - Highlight mode setting.
     * @param {Object} vocabulary - User's vocabulary, containing 'learning' and 'mastered' maps.
     * @returns {Object} Analysis results.
     */
    analyzeWords(words, difficultyLevel, highlightMode, vocabulary) {
        const analysis = {
            totalWords: words.length,
            highlightedWords: [],
            newWords: [],
            difficultyScore: 0,
            wordFrequency: {}
        };

        const { learning: learningWords, mastered: masteredWords } = vocabulary;

        // Count word frequency
        words.forEach(word => {
            analysis.wordFrequency[word] = (analysis.wordFrequency[word] || 0) + 1;
        });

        // Analyze each unique word
        const uniqueWords = [...new Set(words)];
        uniqueWords.forEach(word => {
            const difficulty = this.wordDatabase.getWordDifficulty(word, difficultyLevel);
            
            // A word is never highlighted if it is in the mastered list.
            const isMastered = masteredWords.has(word);
            const isHighlighted = !isMastered && this.shouldHighlight(word, difficulty, highlightMode, learningWords);
            
            if (isHighlighted) {
                analysis.highlightedWords.push({
                    word: word,
                    difficulty: difficulty,
                    frequency: analysis.wordFrequency[word],
                    translation: this.getTranslation(word)
                });
                
                // A word is new only if it's in neither list.
                if (!learningWords.has(word)) {
                    analysis.newWords.push(word);
                }
            }
            
            analysis.difficultyScore += difficulty.score;
        });

        analysis.difficultyScore = uniqueWords.length > 0 ? Math.round(analysis.difficultyScore / uniqueWords.length) : 0;
        
        return analysis;
    }

    /**
     * Determine if a word should be highlighted based on settings and vocabulary.
     * @param {string} word - Word to check.
     * @param {Object} difficulty - Difficulty information.
     * @param {string} highlightMode - Highlight mode.
     * @param {Map} learningWords - The user's list of words they are learning.
     * @returns {boolean} True if the word should be highlighted.
     */
    shouldHighlight(word, difficulty, highlightMode, learningWords) {
        switch (highlightMode) {
            case 'unknown':
                // Highlight difficult words that are not in the learning list.
                return !learningWords.has(word) && (difficulty.level === 'expert' || difficulty.level === 'advanced');
            case 'difficult':
                // Highlight all difficult words, regardless of whether they are in the learning list.
                return difficulty.level === 'expert' || difficulty.level === 'advanced' || difficulty.level === 'intermediate';
            case 'all':
                // Highlight all words that are not marked as mastered.
                return true;
            default:
                return false;
        }
    }

    /**
     * Get translation for a word
     * @param {string} word - Word to translate
     * @returns {string} Translation
     */
    getTranslation(word) {
        // Mock translation - in a real app, you'd call a translation API
        const translations = {
            'hello': '你好',
            'world': '世界',
            'beautiful': '美丽的',
            'amazing': '令人惊叹的',
            'wonderful': '精彩的',
            'fantastic': '极好的',
            'excellent': '优秀的',
            'outstanding': '杰出的',
            'remarkable': '非凡的',
            'extraordinary': '非凡的'
        };
        
        return translations[word] || 'Translation not available';
    }

    /**
     * Process text for display with highlighted words
     * @param {string} originalText - Original text
     * @param {Object} analysis - Analysis results
     * @returns {string} Processed HTML text
     */
    processTextForDisplay(originalText, analysis) {
        let processedText = originalText;
        
        // Create a map of highlighted words for quick lookup
        const highlightedMap = {};
        analysis.highlightedWords.forEach(item => {
            highlightedMap[item.word] = item;
        });
        
        // Replace words with highlighted versions
        const words = this.extractWords(originalText);
        const uniqueWords = [...new Set(words)];
        
        uniqueWords.forEach(word => {
            if (highlightedMap[word]) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                processedText = processedText.replace(regex, 
                    `<span class="highlighted-word ${highlightedMap[word].difficulty.className}" 
                     data-word="${word}" 
                     data-translation="${highlightedMap[word].translation}">${word}</span>`
                );
            }
        });
        
        return processedText;
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
}
