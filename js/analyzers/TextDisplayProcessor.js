/**
 * TextDisplayProcessor Module
 * Handles text processing for display with annotations
 */
export class TextDisplayProcessor {
    constructor(tokenizer, translationFormatter) {
        this.tokenizer = tokenizer;
        this.translationFormatter = translationFormatter;
    }

    async processTextForDisplay(originalText, analysis, getTranslationFn) {
        const highlightedMap = new Map(
            analysis.highlightedWords.map(item => [item.word.toLowerCase(), item])
        );

        const parts = this.tokenizer.splitTextByWords(originalText);
        const uniqueWords = [...new Set(parts.filter(part => this.tokenizer.isWord(part)))];
        
        const translationMap = await this.buildTranslationMap(analysis, uniqueWords, getTranslationFn);
        const processedParts = parts.map((part, index) => this.processPart(part, highlightedMap, translationMap, parts, index));
        
        return processedParts.join('');
    }

    async buildTranslationMap(analysis, uniqueWords, getTranslationFn) {
        const translationMap = new Map();
        
        for (const item of analysis.highlightedWords) {
            if (item.translation) {
                translationMap.set(item.word.toLowerCase(), item.translation);
            }
        }
        
        const wordsNeedingTranslation = uniqueWords.filter(w => !translationMap.has(w.toLowerCase()));
        
        if (wordsNeedingTranslation.length > 0) {
            const batchTranslations = await Promise.all(
                wordsNeedingTranslation.map(word => getTranslationFn(word))
            );
            wordsNeedingTranslation.forEach((word, index) => {
                translationMap.set(word.toLowerCase(), batchTranslations[index]);
            });
        }
        
        return translationMap;
    }

    /**
     * Build a small lowercase word context window around the given index.
     * @param {string[]} parts - Tokenized text parts
     * @param {number} index - Current token index
     * @returns {string[]} Lowercased context words
     */
    getContextWords(parts, index, windowSize = 8) {
        const start = Math.max(0, index - windowSize);
        const end = Math.min(parts.length, index + windowSize + 1);
        const contextWords = [];
        for (let i = start; i < end; i++) {
            if (i === index) continue;
            const part = parts[i];
            if (/^[a-zA-Z]+$/.test(part)) {
                contextWords.push(part.toLowerCase());
            }
        }
        return contextWords;
    }


    processPart(part, highlightedMap, translationMap, parts, index) {
        const lowerCasePart = part.toLowerCase();
        
        if (!this.tokenizer.isWord(lowerCasePart)) {
            return part;
        }

        const highlightedInfo = highlightedMap.get(lowerCasePart);
        const translation = translationMap.get(lowerCasePart) || '';
        const escapedTranslation = this.translationFormatter.escapeHtmlAttribute(translation);
        const contextWords = this.getContextWords(parts, index);

        let chineseAnnotation = '';
        if (highlightedInfo) {
            chineseAnnotation = this.translationFormatter.selectChineseTranslationForContext(part, translation, contextWords);
        }
        const escapedChinese = this.translationFormatter.escapeHtml(chineseAnnotation);

        let containerClasses = 'double-ruby word-span';
        if (highlightedInfo) {
            containerClasses += ` highlight ${highlightedInfo.difficulty.className}`;
        }

        let phoneticAnnotation = '&nbsp;';
        if (highlightedInfo?.phonetic) {
            phoneticAnnotation = this.translationFormatter.escapeHtml(highlightedInfo.phonetic);
        }

        const chineseRt = escapedChinese || '&nbsp;';

        return `<span class="${containerClasses}" data-word="${part}" data-translation="${escapedTranslation}">` +
               `<ruby class="over"><rt>${phoneticAnnotation}</rt></ruby>` +
               `<span class="base">${part}</span>` +
               `<ruby class="under"><rt>${chineseRt}</rt></ruby>` +
               `</span>`;
    }
}
