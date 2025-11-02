/**
 * WordAnalysisEngine Module
 * Handles word analysis workflow and data processing
 * Uses DirectDataStorage as the data access layer
 */
export class WordAnalysisEngine {
    constructor(dataStorage, tokenizer, difficultyCalculator, exchangeParser) {
        this.dataStorage = dataStorage;  // Uses DirectDataStorage instead of WordDatabase
        this.tokenizer = tokenizer;
        this.difficultyCalculator = difficultyCalculator;
        this.exchangeParser = exchangeParser;
    }

    async analyzeWords(words, difficultyLevel, highlightMode, vocabulary) {
        const analysis = {
            totalWords: words.length,
            highlightedWords: [],
            newWords: [],
            difficultyScore: 0,
            wordFrequency: {}
        };

        const { learning: learningWords, mastered: masteredWords } = vocabulary;
        analysis.wordFrequency = this.tokenizer.countWordFrequency(words);
        const uniqueWords = this.tokenizer.getUniqueWords(words);
        
        const startTime = performance.now();
        const wordDataMap = await this.batchQueryWords(uniqueWords);
        const lemmasToQuery = this.collectLemmasToQuery(uniqueWords, wordDataMap);
        
        if (lemmasToQuery.size > 0) {
            const lemmaDataMap = await this.batchQueryWords(Array.from(lemmasToQuery));
            lemmaDataMap.forEach((data, word) => wordDataMap.set(word, data));
        }
        
        for (const lowerWord of uniqueWords) {
            const originalWord = words.find(word => word.toLowerCase() === lowerWord) || lowerWord;
            const wordData = wordDataMap.get(lowerWord);
            const difficultyData = this.getDifficultyData(lowerWord, wordData, wordDataMap);
            let difficulty = this.difficultyCalculator.calculateDifficulty(difficultyData, lowerWord);
            
            const isMastered = masteredWords.has(lowerWord);
            const isLearning = learningWords.has(lowerWord);
            
            if (isLearning) {
                difficulty = { ...this.difficultyCalculator.EXPERT_DIFFICULTY, info: difficulty.info };
            }
            
            const isHighlighted = !isMastered && (isLearning || 
                this.difficultyCalculator.shouldHighlight(lowerWord, difficulty, highlightMode, learningWords, difficultyLevel));
            
            if (isHighlighted) {
                analysis.highlightedWords.push({
                    word: originalWord,
                    difficulty: difficulty,
                    frequency: analysis.wordFrequency[lowerWord],
                    wordData: wordData
                });
                
                if (!learningWords.has(lowerWord)) {
                    analysis.newWords.push(lowerWord);
                }
            }
            
            analysis.difficultyScore += difficulty.score;
        }

        console.log(`📊 Analyzed ${uniqueWords.length} unique words in ${(performance.now() - startTime).toFixed(2)}ms`);
        analysis.difficultyScore = uniqueWords.length > 0 ? Math.round(analysis.difficultyScore / uniqueWords.length) : 0;
        
        return analysis;
    }

    async batchQueryWords(words) {
        const wordDataMap = new Map();
        
        // Use DirectDataStorage's batch query method
        const batchResults = await this.dataStorage.queryWordsBatch(words);
        batchResults.forEach(result => {
            if (result.data) wordDataMap.set(result.word, result.data);
        });
        
        return wordDataMap;
    }

    collectLemmasToQuery(uniqueWords, wordDataMap) {
        const lemmasToQuery = new Set();
        
        for (const lowerWord of uniqueWords) {
            const wordData = wordDataMap.get(lowerWord);
            if (wordData && !this.difficultyCalculator.hasMetadata(wordData) && wordData.exchange) {
                const lemma = this.exchangeParser.getLemma(wordData.exchange);
                if (lemma && lemma.toLowerCase() !== lowerWord) {
                    const lemmaLower = lemma.toLowerCase();
                    if (!wordDataMap.has(lemmaLower)) {
                        lemmasToQuery.add(lemmaLower);
                    }
                }
            }
        }
        
        return lemmasToQuery;
    }

    getDifficultyData(lowerWord, wordData, wordDataMap) {
        if (wordData && !this.difficultyCalculator.hasMetadata(wordData) && wordData.exchange) {
            const lemma = this.exchangeParser.getLemma(wordData.exchange);
            if (lemma && lemma.toLowerCase() !== lowerWord) {
                const lemmaData = wordDataMap.get(lemma.toLowerCase());
                if (lemmaData && this.difficultyCalculator.hasMetadata(lemmaData)) {
                    return lemmaData;
                }
            }
        }
        
        return wordData;
    }
}
