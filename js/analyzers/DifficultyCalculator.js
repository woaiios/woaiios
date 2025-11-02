/**
 * DifficultyCalculator Module
 * Handles word difficulty calculation and classification
 */
export class DifficultyCalculator {
    constructor() {
        // Expert difficulty configuration for learning words
        this.EXPERT_DIFFICULTY = {
            level: 'expert',
            score: 100,
            className: 'expert'
        };

        this.DIFFICULTY_ORDER = {
            'common': 0,
            'beginner': 1,
            'intermediate': 2,
            'advanced': 3,
            'expert': 4,
            'unknown': 5
        };
    }

    /**
     * Check if word data has difficulty metadata
     * @param {Object} wordInfo - Word information
     * @returns {boolean} True if word has metadata
     */
    hasMetadata(wordInfo) {
        if (!wordInfo) return false;
        
        const tag = wordInfo.tag || '';
        
        // Check for any difficulty indicators
        return (
            wordInfo.oxford === 1 || wordInfo.oxford === true ||
            wordInfo.collins > 0 ||
            wordInfo.bnc > 0 ||
            tag.includes('zk') || tag.includes('gk') || 
            tag.includes('cet4') || tag.includes('cet6') ||
            tag.includes('ielts') || tag.includes('toefl') ||
            tag.includes('gre')
        );
    }

    /**
     * Calculate difficulty from word data
     * @param {Object} wordInfo - Word information
     * @param {string} word - Word being analyzed
     * @returns {Object} Difficulty information {level, score, className, info}
     */
    calculateDifficulty(wordInfo, word) {
        // If not found in database, treat as common word (don't highlight)
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

        // Oxford 3000 core vocabulary
        if (wordInfo.oxford === 1 || wordInfo.oxford === true) {
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
     * Determine if a word should be highlighted based on settings and vocabulary
     * @param {string} word - Word to check
     * @param {Object} difficulty - Difficulty information
     * @param {string} highlightMode - Highlight mode ('unknown', 'difficult', 'all')
     * @param {Map} learningWords - The user's list of words they are learning
     * @param {string} userDifficultyLevel - The user's selected difficulty threshold
     * @returns {boolean} True if the word should be highlighted
     */
    shouldHighlight(word, difficulty, highlightMode, learningWords, userDifficultyLevel) {
        const wordDifficultyIndex = this.DIFFICULTY_ORDER[difficulty.level];
        const userDifficultyIndex = this.DIFFICULTY_ORDER[userDifficultyLevel];

        // Determine if the word is considered difficult for the user
        const isDifficultForUser = wordDifficultyIndex > userDifficultyIndex;

        switch (highlightMode) {
            case 'unknown':
                // Highlight difficult words that are not in the learning list
                return isDifficultForUser && !learningWords.has(word);
            case 'difficult':
                // Highlight all words considered difficult for the user
                return isDifficultForUser;
            case 'all':
                // Highlight all words that are not marked as mastered
                return true;
            default:
                return false;
        }
    }

    /**
     * Calculate difficulty distribution for a set of words
     * @param {Array<Object>} wordDataList - Array of word data objects
     * @returns {Object} Difficulty distribution
     */
    calculateDifficultyDistribution(wordDataList) {
        const distribution = {
            common: 0,
            beginner: 0,
            intermediate: 0,
            advanced: 0,
            expert: 0
        };

        wordDataList.forEach(wordData => {
            const difficulty = this.calculateDifficulty(wordData);
            distribution[difficulty.level]++;
        });

        return distribution;
    }

    /**
     * Calculate average difficulty score
     * @param {Array<Object>} difficulties - Array of difficulty objects
     * @returns {number} Average score
     */
    calculateAverageScore(difficulties) {
        if (difficulties.length === 0) return 0;
        
        const totalScore = difficulties.reduce((sum, diff) => sum + diff.score, 0);
        return Math.round(totalScore / difficulties.length);
    }
}
