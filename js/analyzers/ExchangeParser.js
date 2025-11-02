/**
 * ExchangeParser Module
 * Handles parsing of exchange field for word forms
 */
export class ExchangeParser {
    constructor() {
        // Constants for exchange field parsing
        this.LEMMA_KEY = '0';           // Primary lemma (base form)
        this.LEMMA_VARIATION_KEY = '1'; // Alternative lemma form
        
        this.FORM_LABELS = {
            'p': '过去式',
            'd': '过去分词',
            'i': '现在分词',
            '3': '第三人称单数',
            'r': '比较级',
            't': '最高级',
            's': '复数',
            '0': '原形'
        };
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
            [this.LEMMA_KEY]: null,           // primary lemma (base form)
            [this.LEMMA_VARIATION_KEY]: null  // alternative lemma form
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
     * Format word forms for display
     * @param {string} exchange - Exchange field from database
     * @returns {string} Formatted word forms string
     */
    formatWordForms(exchange) {
        if (!exchange) return '';

        const forms = this.parseExchange(exchange);
        const validForms = [];
        
        for (const [key, value] of Object.entries(forms)) {
            if (value && this.FORM_LABELS[key]) {
                validForms.push(`${this.FORM_LABELS[key]}: ${value}`);
            }
        }

        return validForms.join(' | ');
    }

    /**
     * Get lemma from exchange field
     * @param {string} exchange - Exchange field from database
     * @returns {string|null} Lemma (base form) or null
     */
    getLemma(exchange) {
        if (!exchange) return null;
        
        const forms = this.parseExchange(exchange);
        return forms[this.LEMMA_KEY] || forms[this.LEMMA_VARIATION_KEY] || null;
    }
}
