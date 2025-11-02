/**
 * WordQueryService - Word Query Operations
 * Provides common query operations for both storage layers
 */
import { DifficultyAnalyzer } from './DifficultyAnalyzer.js';

export class WordQueryService {
    constructor(queryAdapter, cacheManager = null) {
        this.adapter = queryAdapter;
        this.cache = cacheManager;
    }

    /**
     * Query single word with caching
     */
    async queryWord(word) {
        const lowerWord = word.toLowerCase();

        // Check cache first
        if (this.cache) {
            const cached = this.cache.get(lowerWord);
            if (cached !== null) {
                return cached;
            }
        }

        // Query from adapter
        const result = await this.adapter.queryWord(word);

        // Store in cache
        if (this.cache && result) {
            this.cache.set(lowerWord, result);
        }

        return result;
    }

    /**
     * Batch query words with caching
     */
    async queryWordsBatch(words) {
        const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];
        const results = [];
        const toQuery = [];

        // Check cache first
        for (const word of uniqueWords) {
            if (this.cache) {
                const cached = this.cache.get(word);
                if (cached !== null) {
                    results.push({ word, data: cached });
                    continue;
                }
            }
            toQuery.push(word);
        }

        // Query remaining words
        if (toQuery.length > 0) {
            const queryResults = await this.adapter.queryWordsBatch(toQuery);
            
            // Cache results
            if (this.cache) {
                for (const { word, data } of queryResults) {
                    if (data) {
                        this.cache.set(word.toLowerCase(), data);
                    }
                }
            }
            
            results.push(...queryResults);
        }

        return results;
    }

    /**
     * Get word difficulty with lemma fallback
     */
    async getWordDifficulty(word, maxDepth = 3) {
        return this._getDifficultyRecursive(word, 0, maxDepth);
    }

    /**
     * Internal recursive difficulty calculation
     */
    async _getDifficultyRecursive(word, depth, maxDepth) {
        // Prevent infinite recursion
        if (depth >= maxDepth) {
            return {
                level: 'common',
                score: 0,
                className: 'common',
                info: null
            };
        }

        const wordInfo = await this.queryWord(word);
        
        if (!wordInfo) {
            return {
                level: 'common',
                score: 0,
                className: 'common',
                info: null
            };
        }

        const difficulty = DifficultyAnalyzer.calculateDifficulty(wordInfo);

        // If no metadata found, try base form
        if (!difficulty.hasMetadata && wordInfo.exchange) {
            const lemma = DifficultyAnalyzer.getLemmaFromExchange(wordInfo.exchange);
            
            if (lemma && lemma.toLowerCase() !== word.toLowerCase()) {
                return await this._getDifficultyRecursive(lemma, depth + 1, maxDepth);
            }
        }

        return difficulty;
    }

    /**
     * Parse exchange field
     */
    parseExchange(exchange) {
        return DifficultyAnalyzer.parseExchange(exchange);
    }
}
