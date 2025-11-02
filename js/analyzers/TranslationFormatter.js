/**
 * TranslationFormatter Module
 * Handles translation formatting and HTML generation
 */
export class TranslationFormatter {
    constructor(exchangeParser) {
        this.exchangeParser = exchangeParser;
        this.translationCache = new Map();
        this.maxCacheSize = 5000; // Limit cache size

        // Tag name mappings
        this.TAG_NAMES = {
            'zk': '中考', 'gk': '高考', 'cet4': 'CET-4', 'cet6': 'CET-6',
            'ielts': 'IELTS', 'toefl': 'TOEFL', 'gre': 'GRE', 
            'tem4': 'TEM-4', 'tem8': 'TEM-8'
        };
    }

    /**
     * Format translation from word data
     * @param {string} word - Original word
     * @param {Object} wordInfo - Word information
     * @returns {string} Translation HTML
     */
    formatTranslation(word, wordInfo) {
        if (!wordInfo) {
            return `<div class="word-info">
                <h3>${word}</h3>
                <p class="no-translation">未找到释义</p>
            </div>`;
        }

        const lowerWord = word.toLowerCase();
        
        // Check cache first
        if (this.translationCache.has(lowerWord)) {
            return this.translationCache.get(lowerWord);
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
        
        // Collapsible details section
        html += `<div class="word-details-toggle" onclick="this.parentElement.classList.toggle('expanded')">`;
        html += `<span class="toggle-icon">▼</span> <span class="toggle-text">更多详情</span>`;
        html += `</div>`;
        
        html += `<div class="word-details-content">`;
        
        // Add metadata (Collins, Oxford)
        html += this.formatMetadata(wordInfo);
        
        // Add tags
        html += this.formatTags(wordInfo);
        
        // Add full translation
        html += this.formatFullTranslation(wordInfo);
        
        // Add definition
        html += this.formatDefinition(wordInfo);
        
        // Add word forms
        html += this.formatWordForms(wordInfo);
        
        // Add frequency information
        html += this.formatFrequency(wordInfo);
        
        html += `</div>`; // Close word-details-content
        html += `</div>`; // Close word-info
        
        // Store in cache
        this.translationCache.set(lowerWord, html);
        
        // Limit cache size
        if (this.translationCache.size > this.maxCacheSize) {
            const firstKey = this.translationCache.keys().next().value;
            this.translationCache.delete(firstKey);
        }
        
        return html;
    }

    /**
     * Format metadata (Collins stars and Oxford badge)
     * @param {Object} wordInfo - Word information
     * @returns {string} HTML string
     */
    formatMetadata(wordInfo) {
        if (!wordInfo.collins && !wordInfo.oxford) return '';

        let html = `<div class="word-meta">`;
        if (wordInfo.collins > 0) {
            html += `<span class="collins-stars">${'★'.repeat(wordInfo.collins)}</span>`;
        }
        if (wordInfo.oxford) {
            html += `<span class="oxford-badge">Oxford 3000</span>`;
        }
        html += `</div>`;
        
        return html;
    }

    /**
     * Format exam tags
     * @param {Object} wordInfo - Word information
     * @returns {string} HTML string
     */
    formatTags(wordInfo) {
        if (!wordInfo.tag) return '';

        const tags = wordInfo.tag.split(' ').filter(t => t);
        if (tags.length === 0) return '';

        let html = `<div class="word-tags">`;
        tags.forEach(tag => {
            const tagName = this.TAG_NAMES[tag] || tag;
            html += `<span class="tag">${tagName}</span>`;
        });
        html += `</div>`;
        
        return html;
    }

    /**
     * Format full Chinese translation (multiple lines)
     * @param {Object} wordInfo - Word information
     * @returns {string} HTML string
     */
    formatFullTranslation(wordInfo) {
        if (!wordInfo.translation) return '';

        const lines = wordInfo.translation.split('\\n');
        if (lines.length <= 1) return '';

        let html = `<div class="translation">`;
        lines.forEach((line, index) => {
            if (line.trim() && index > 0) { // Skip first line as it's already shown
                html += `<p>${this.escapeHtml(line)}</p>`;
            }
        });
        html += `</div>`;
        
        return html;
    }

    /**
     * Format English definition
     * @param {Object} wordInfo - Word information
     * @returns {string} HTML string
     */
    formatDefinition(wordInfo) {
        if (!wordInfo.definition) return '';

        let html = `<div class="definition">`;
        html += `<h4>English Definition:</h4>`;
        const lines = wordInfo.definition.split('\\n');
        lines.forEach(line => {
            if (line.trim()) {
                html += `<p>${this.escapeHtml(line)}</p>`;
            }
        });
        html += `</div>`;
        
        return html;
    }

    /**
     * Format word forms (exchange)
     * @param {Object} wordInfo - Word information
     * @returns {string} HTML string
     */
    formatWordForms(wordInfo) {
        if (!wordInfo.exchange) return '';

        const formattedForms = this.exchangeParser.formatWordForms(wordInfo.exchange);
        if (!formattedForms) return '';

        let html = `<div class="word-forms">`;
        html += `<h4>词形变化:</h4>`;
        html += `<p>${formattedForms}</p>`;
        html += `</div>`;
        
        return html;
    }

    /**
     * Format frequency information
     * @param {Object} wordInfo - Word information
     * @returns {string} HTML string
     */
    formatFrequency(wordInfo) {
        if (!(wordInfo.bnc > 0 || wordInfo.frq > 0)) return '';

        let html = `<div class="word-frequency">`;
        if (wordInfo.bnc > 0) {
            html += `<span>BNC词频: ${wordInfo.bnc.toLocaleString()}</span>`;
        }
        if (wordInfo.frq > 0) {
            html += `<span>当代词频: ${wordInfo.frq.toLocaleString()}</span>`;
        }
        html += `</div>`;
        
        return html;
    }

    /**
     * Extract first Chinese word from translation HTML
     * @param {string} translationHtml - Full translation HTML
     * @returns {string} First Chinese word (plain text)
     */
    extractFirstChineseTranslation(translationHtml) {
        if (!translationHtml) return '';
        
        // Use DOMParser for safer HTML parsing
        const parser = new DOMParser();
        const doc = parser.parseFromString(translationHtml, 'text/html');
        
        // Try to find the translation in the compact format
        const translationCompact = doc.querySelector('.translation-compact p');
        let fullText = '';
        if (translationCompact) {
            fullText = translationCompact.textContent.trim();
        } else {
            // Fallback: try to find any paragraph in the translation
            const firstP = doc.querySelector('p');
            if (firstP && !firstP.classList.contains('no-translation')) {
                fullText = firstP.textContent.trim();
            }
        }
        
        // Extract the first Chinese word (skip English parts)
        if (fullText) {
            // Remove English parts like "n.", "v.", "adj.", etc.
            let cleanText = fullText.replace(/^[a-zA-Z]+\.\s*/, '');
            
            // Extract the first Chinese word (split by common separators)
            const firstWord = cleanText.split(/[;；,，\s]+/)[0];
            return firstWord || '';
        }
        
        return '';
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
     * Escape HTML for safe attribute usage
     * @param {string} text - Text to escape
     * @returns {string} Escaped text safe for HTML attributes
     */
    escapeHtmlAttribute(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Clear translation cache
     */
    clearCache() {
        this.translationCache.clear();
        console.log('🗑️ Translation cache cleared');
    }

    /**
     * Get cache statistics
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
