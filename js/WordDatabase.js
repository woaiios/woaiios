import { WordLemmatizer } from './WordLemmatizer.js';

/**
 * WordDatabase Module
 * Handles dictionary loading and word difficulty analysis
 */
export class WordDatabase {
    constructor() {
        this.database = null;
        this.isLoaded = false;
    }

    /**
     * Initialize word database with difficulty levels
     * @returns {Promise<Object>} Word database with difficulty categories
     */
    async initialize() {
        try {
            console.log('Loading dictionary from eng_dict.txt...');
            const response = await fetch('./eng_dict.txt');
            if (!response.ok) {
                throw new Error(`Failed to load dictionary: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log(`Dictionary file loaded, size: ${text.length} characters`);
            const lines = text.split('\n');
            console.log(`Total lines in dictionary: ${lines.length}`);
            
            this.database = {
                common: new Set(),
                beginner: new Set(),
                intermediate: new Set(),
                advanced: new Set(),
                expert: new Set()
            };
            
            // Parse each line and categorize words by difficulty level
            lines.forEach((line, index) => {
                if (line.trim()) {
                    // Split by tabs to get all word forms
                    const words = line.split('\t').map(word => word.trim().toLowerCase()).filter(word => word);
                    
                    // Determine difficulty level based on line number
                    const difficulty = this.getDifficultyLevel(index);
                    
                    // Add all word forms to the appropriate difficulty set
                    words.forEach(word => {
                        this.database[difficulty].add(word);
                    });
                }
            });
            
            console.log('Dictionary loaded successfully:', {
                common: this.database.common.size,
                beginner: this.database.beginner.size,
                intermediate: this.database.intermediate.size,
                advanced: this.database.advanced.size,
                expert: this.database.expert.size
            });
            
            this.isLoaded = true;
            return this.database;
            
        } catch (error) {
            console.error('Error loading dictionary:', error);
            // Fallback to empty sets if dictionary loading fails
            this.database = {
                common: new Set(),
                beginner: new Set(),
                intermediate: new Set(),
                advanced: new Set(),
                expert: new Set()
            };
            this.isLoaded = false;
            return this.database;
        }
    }

    /**
     * Get difficulty level based on line index
     * @param {number} index - Line index in dictionary
     * @returns {string} Difficulty level
     */
    getDifficultyLevel(index) {
        if (index < 1000) return 'common';
        if (index < 3000) return 'beginner';
        if (index < 5000) return 'intermediate';
        if (index < 8000) return 'advanced';
        return 'expert';
    }

    /**
     * Get word difficulty information
     * @param {string} word - Word to analyze
     * @param {string} difficultyLevel - Current difficulty level setting
     * @returns {Object} Difficulty information
     */
    getWordDifficulty(word) {
        if (!this.isLoaded) {
            return {
                level: 'unknown',
                score: 100,
                className: 'unknown'
            };
        }

        const levels = ['common', 'beginner', 'intermediate', 'advanced', 'expert'];
        
        // First try the word as-is
        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            if (this.database[level].has(word)) {
                return {
                    level: level,
                    score: i * 25,
                    className: level
                };
            }
        }
        
        // If not found, try lemmatized forms
        const lemmas = WordLemmatizer.lemmatize(word);
        for (const lemma of lemmas) {
            for (let i = 0; i < levels.length; i++) {
                const level = levels[i];
                if (this.database[level].has(lemma)) {
                    return {
                        level: level,
                        score: i * 25,
                        className: level
                    };
                }
            }
        }
        
        return {
            level: 'expert',
            score: 100,
            className: 'unknown'
        };
    }

    /**
     * Check if database is loaded
     * @returns {boolean} Loading status
     */
    isDatabaseLoaded() {
        return this.isLoaded;
    }

    /**
     * Get database statistics
     * @returns {Object} Database statistics
     */
    getStatistics() {
        if (!this.isLoaded) return null;
        
        return {
            common: this.database.common.size,
            beginner: this.database.beginner.size,
            intermediate: this.database.intermediate.size,
            advanced: this.database.advanced.size,
            expert: this.database.expert.size,
            total: Object.values(this.database).reduce((sum, set) => sum + set.size, 0)
        };
    }
}
