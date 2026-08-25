/**
 * DifficultyAnalyzer - Word Difficulty Assessment
 * Analyzes word difficulty based on ECDICT metadata
 */
export class DifficultyAnalyzer {
    /**
     * Parse exchange field to get word forms
     * @param {string} exchange - Exchange field from database
     * @returns {Object} Word forms
     */
    static parseExchange(exchange) {
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
     * Calculate difficulty level based on word metadata
     * @param {Object} wordInfo - Word information from database
     * @returns {Object} Difficulty assessment
     */
    static calculateDifficulty(wordInfo) {
        if (!wordInfo) {
            return {
                level: 'common',
                score: 0,
                className: 'common',
                info: null
            };
        }

        // Priority-based difficulty determination:
        // 1. Oxford 3000 core words
        // 2. Collins stars (1-5)
        // 3. Tag (exam levels)
        // 4. Word frequency (BNC)

        let level = 'common';
        let score = 0;
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
        // 没有可识别难度信号的词典词默认 common/0（不再为 expert），
        // 避免绝大多数普通词被误判为“超难”而被高亮。

        return {
            level,
            score,
            className: level,
            info: wordInfo,
            hasMetadata
        };
    }

    /**
     * Get lemma (base form) from exchange data
     * @param {string} exchange - Exchange field
     * @returns {string|null} Lemma word
     */
    static getLemmaFromExchange(exchange) {
        if (!exchange) return null;
        
        const forms = this.parseExchange(exchange);
        return forms['0'] || forms['1'] || null;
    }
}
