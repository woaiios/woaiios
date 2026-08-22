/**
 * WordTokenizer Module
 * Handles text tokenization and word extraction
 */
export class WordTokenizer {
    constructor() {
        this.tokenizer = null;
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
                console.log('✅ Intl.Segmenter loaded successfully');
            } else {
                throw new Error('Intl.Segmenter not supported in this browser');
            }
        } catch (error) {
            console.warn('⚠️ Error loading Intl.Segmenter, falling back to simple extraction:', error);
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
        if (!text) return [];

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
     * Count word frequency
     * @param {Array<string>} words - Array of words
     * @returns {Object} Word frequency map (lowercase keys)
     */
    countWordFrequency(words) {
        const frequency = {};
        
        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            frequency[lowerWord] = (frequency[lowerWord] || 0) + 1;
        });

        return frequency;
    }

    /**
     * Get unique words (case-insensitive)
     * @param {Array<string>} words - Array of words
     * @returns {Array<string>} Array of unique words (lowercase)
     */
    getUniqueWords(words) {
        return [...new Set(words.map(word => word.toLowerCase()))];
    }

    /**
     * Split text by word boundaries for display processing
     * @param {string} text - Input text
     * @returns {Array<string>} Array of parts (words and delimiters)
     */
    splitTextByWords(text) {
        // Use the same Intl.Segmenter segmentation as extractWords for display.
        if (this.tokenizer && this.tokenizer.segment) {
            const parts = [];
            for (const segment of this.tokenizer.segment(text)) {
                parts.push(segment.segment);
            }
            return parts;
        }

        // Fallback for browsers without Intl.Segmenter.
        return text.split(/(\b[a-zA-Z-]+\b)/);
    }

    /**
     * Check if a part is a word
     * @param {string} part - Text part
     * @returns {boolean} True if part is a word
     */
    isWord(part) {
        // Match extractWords: only pure Latin words longer than one character.
        return /^[a-zA-Z]+$/.test(part) && part.length > 1;
    }
}
