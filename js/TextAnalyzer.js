import { WordLemmatizer } from './WordLemmatizer.js';

/**
 * TextAnalyzer Module
 * Handles text analysis and word processing logic
 */
export class TextAnalyzer {
    constructor(wordDatabase, translationService) {
        this.wordDatabase = wordDatabase;
        this.translationService = translationService;
        this.dictionary = null;
        this.wordFormsMap = new Map(); // Map word forms to their base forms
        this.tokenizer = null;
        this.loadDictionaries();
        this.loadTokenizer();
    }

    /**
     * Load the English-Chinese dictionary from JSON file and word forms mapping
     */
    async loadDictionaries() {
        try {
            // Load the JSON dictionary
            const dictResponse = await fetch('./eng-zho.json');
            if (dictResponse.ok) {
                this.dictionary = await dictResponse.json();
                console.log('JSON dictionary loaded successfully');
            } else {
                console.warn('Failed to load JSON dictionary');
            }

            // Load the word forms mapping from eng_dict.txt
            const formsResponse = await fetch('./eng_dict.txt');
            if (formsResponse.ok) {
                const text = await formsResponse.text();
                const lines = text.split('\n');
                
                // Create a mapping from word forms to their base forms (first word in each line)
                lines.forEach(line => {
                    if (line.trim()) {
                        const words = line.split('\t').map(word => word.trim().toLowerCase()).filter(word => word);
                        const baseForm = words[0]; // First word is the base form
                        
                        // Map each word form to its base form
                        words.forEach(word => {
                            this.wordFormsMap.set(word, baseForm);
                        });
                    }
                });
                
                console.log(`Word forms mapping loaded: ${this.wordFormsMap.size} entries`);
            } else {
                console.warn('Failed to load word forms mapping');
            }
        } catch (error) {
            console.warn('Error loading dictionaries:', error);
        }
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

        // Count word frequency using lowercase for counting but preserving original case for display
        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            analysis.wordFrequency[lowerWord] = (analysis.wordFrequency[lowerWord] || 0) + 1;
        });

        // Analyze each unique word (using lowercase for comparison)
        const uniqueWords = [...new Set(words.map(word => word.toLowerCase()))];
        uniqueWords.forEach(lowerWord => {
            // Find the original casing of the word for display
            const originalWord = words.find(word => word.toLowerCase() === lowerWord) || lowerWord;
            
            const difficulty = this.wordDatabase.getWordDifficulty(lowerWord);
            
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
                    translation: this.getTranslation(originalWord) // Use original casing for lookup
                });
                
                // A word is new only if it's in neither list.
                if (!learningWords.has(lowerWord)) {
                    analysis.newWords.push(lowerWord);
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
     * Get translation for a word
     * @param {string} word - Word to translate
     * @returns {string} Translation
     */
    getTranslation(word) {
        // First try to find the base form of the word with original casing
        let baseForm = this.wordFormsMap.get(word);
        
        // If not found, try with lowercase
        if (!baseForm) {
            baseForm = this.wordFormsMap.get(word.toLowerCase());
        }
        
        // If we couldn't find a base form in the map, try lemmatization
        if (!baseForm) {
            const lemmas = WordLemmatizer.lemmatize(word);
            for (const lemma of lemmas) {
                const foundBase = this.wordFormsMap.get(lemma);
                if (foundBase) {
                    baseForm = foundBase;
                    break;
                }
            }
        }
        
        // If we still couldn't find a base form, use the word itself
        if (!baseForm) {
            baseForm = word;
        }
        
        // Use real dictionary if loaded - try original case first
        if (this.dictionary && this.dictionary[baseForm]) {
            // Return the full HTML fragment with corrected paths
            let htmlFragment = this.dictionary[baseForm];
            
            // Fix the stylesheet paths by replacing ~/ with the correct relative path
            // The CSS files are located in eng-zho.json_res/css/ relative to the project root
            htmlFragment = htmlFragment.replace(/href="~\//g, 'href="./eng-zho.json_res/');
            
            return htmlFragment;
        }
        
        // If not found, try with lowercase
        const lowerBaseForm = baseForm.toLowerCase();
        if (this.dictionary && this.dictionary[lowerBaseForm]) {
            // Return the full HTML fragment with corrected paths
            let htmlFragment = this.dictionary[lowerBaseForm];
            
            // Fix the stylesheet paths by replacing ~/ with the correct relative path
            // The CSS files are located in eng-zho.json_res/css/ relative to the project root
            htmlFragment = htmlFragment.replace(/href="~\//g, 'href="./eng-zho.json_res/');
            
            return htmlFragment;
        }
        
        // If still not found, try lemmatized forms directly in dictionary
        const lemmas = WordLemmatizer.lemmatize(word);
        for (const lemma of lemmas) {
            if (this.dictionary && this.dictionary[lemma]) {
                let htmlFragment = this.dictionary[lemma];
                htmlFragment = htmlFragment.replace(/href="~\//g, 'href="./eng-zho.json_res/');
                return htmlFragment;
            }
        }
        
        // Fallback to mock translations if dictionary not available or word not found
        const mockTranslations = {
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
        
        // Try original case first
        let translation = mockTranslations[word];
        if (!translation) {
            // Fall back to lowercase
            translation = mockTranslations[word.toLowerCase()] || 'Translation not available';
        }
        
        // If translation is not available, provide a Google search link
        if (translation === 'Translation not available') {
            return `<a href="https://www.google.com/search?q=${encodeURIComponent(word)}+meaning in Chinese" target="_blank" style="color: #1a0dab; text-decoration: underline;">Translation not available - Search on Google</a>`;
        }
        
        return translation;
    }

    /**
     * Process text for display with highlighted words
     * @param {string} originalText - Original text
     * @param {Object} analysis - Analysis results
     * @returns {string} Processed HTML text
     */
    processTextForDisplay(originalText, analysis) {
        const highlightedMap = new Map(analysis.highlightedWords.map(item => [item.word.toLowerCase(), item]));

        // Split the text by word boundaries, keeping the delimiters.
        const parts = originalText.split(/(\b[a-zA-Z-]+\b)/);

        return parts.map(part => {
            const lowerCasePart = part.toLowerCase();
            // Check if the part is a word and not just a delimiter.
            if (!/\b[a-zA-Z-]+\b/.test(lowerCasePart)) {
                return part; // Return delimiters as is.
            }

            const highlightedInfo = highlightedMap.get(lowerCasePart);
            // Use the original part for translation to preserve casing
            const translation = this.getTranslation(part);
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
        }).join('');
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