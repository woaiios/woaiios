/**
 * TextAnalyzer Module (Refactored)
 * Handles text analysis and word processing logic
 */
import { WordTokenizer } from './analyzers/WordTokenizer.js';
import { DifficultyCalculator } from './analyzers/DifficultyCalculator.js';
import { TranslationFormatter } from './analyzers/TranslationFormatter.js';
import { ExchangeParser } from './analyzers/ExchangeParser.js';
import { WordAnalysisEngine } from './analyzers/WordAnalysisEngine.js';
import { TextDisplayProcessor } from './analyzers/TextDisplayProcessor.js';

export class TextAnalyzer {
    constructor(wordDatabase, translationService) {
        this.wordDatabase = wordDatabase;
        this.translationService = translationService;
        
        this.exchangeParser = new ExchangeParser();
        this.tokenizer = new WordTokenizer();
        this.difficultyCalculator = new DifficultyCalculator();
        this.translationFormatter = new TranslationFormatter(this.exchangeParser);
        this.analysisEngine = new WordAnalysisEngine(wordDatabase, this.tokenizer, this.difficultyCalculator, this.exchangeParser);
        this.displayProcessor = new TextDisplayProcessor(this.tokenizer, this.translationFormatter);
    }

    extractWords(text) {
        return this.tokenizer.extractWords(text);
    }

    parseExchange(exchange) {
        return this.exchangeParser.parseExchange(exchange);
    }

    hasMetadata(wordInfo) {
        return this.difficultyCalculator.hasMetadata(wordInfo);
    }

    async analyzeWords(words, difficultyLevel, highlightMode, vocabulary) {
        const analysis = await this.analysisEngine.analyzeWords(words, difficultyLevel, highlightMode, vocabulary);
        
        // Add translations to highlighted words
        for (const item of analysis.highlightedWords) {
            item.translation = this.translationFormatter.formatTranslation(item.word, item.wordData);
            item.phonetic = item.wordData?.phonetic || '';
        }
        
        return analysis;
    }

    calculateDifficultyFromData(wordInfo, word) {
        return this.difficultyCalculator.calculateDifficulty(wordInfo, word);
    }

    formatTranslationFromData(word, wordInfo) {
        return this.translationFormatter.formatTranslation(word, wordInfo);
    }

    shouldHighlight(word, difficulty, highlightMode, learningWords, userDifficultyLevel) {
        return this.difficultyCalculator.shouldHighlight(word, difficulty, highlightMode, learningWords, userDifficultyLevel);
    }

    async getTranslation(word) {
        const lowerWord = word.toLowerCase();
        
        if (this.translationFormatter.translationCache.has(lowerWord)) {
            return this.translationFormatter.translationCache.get(lowerWord);
        }
        
        if (!this.wordDatabase.isDatabaseLoaded()) {
            return `<div class="word-info"><p>数据库未加载</p></div>`;
        }
        
        let wordInfo = await this.wordDatabase.queryWord(lowerWord);
        if (!wordInfo) {
            wordInfo = await this.wordDatabase.findByLemma(lowerWord);
        }
        
        return this.translationFormatter.formatTranslation(word, wordInfo);
    }

    extractFirstChineseTranslation(translationHtml) {
        return this.translationFormatter.extractFirstChineseTranslation(translationHtml);
    }

    escapeHtml(text) {
        return this.translationFormatter.escapeHtml(text);
    }

    escapeHtmlAttribute(text) {
        return this.translationFormatter.escapeHtmlAttribute(text);
    }

    async processTextForDisplay(originalText, analysis) {
        return this.displayProcessor.processTextForDisplay(originalText, analysis, (word) => this.getTranslation(word));
    }

    calculateComplexityMetrics(words, difficultyLevel) {
        const uniqueWords = this.tokenizer.getUniqueWords(words);
        const totalLength = words.reduce((sum, word) => sum + word.length, 0);
        
        const metrics = {
            totalWords: words.length,
            uniqueWords: uniqueWords.length,
            averageWordLength: Math.round(totalLength / words.length * 10) / 10,
            difficultyDistribution: { common: 0, beginner: 0, intermediate: 0, advanced: 0, expert: 0 }
        };

        uniqueWords.forEach(word => {
            const difficulty = this.wordDatabase.getWordDifficulty(word, difficultyLevel);
            metrics.difficultyDistribution[difficulty.level]++;
        });

        return metrics;
    }
    
    clearTranslationCache() {
        this.translationFormatter.clearCache();
    }
    
    getCacheStats() {
        return this.translationFormatter.getCacheStats();
    }
}
