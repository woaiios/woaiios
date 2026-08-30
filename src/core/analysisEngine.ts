/**
 * core/analysisEngine — 单词分析工作流（纯逻辑，数据访问经 WordDataAccess 注入）
 */

import type { AnalysisResult, DifficultyResult, VocabularyLists, WordDataAccess, WordInfo } from './types';
import type { WordTokenizer } from './tokenizer';
import type { DifficultyCalculator } from './difficultyCalculator';
import type { ExchangeParser } from './exchangeParser';

export class WordAnalysisEngine {
  constructor(
    private readonly dataStorage: WordDataAccess,
    private readonly tokenizer: WordTokenizer,
    private readonly difficultyCalculator: DifficultyCalculator,
    private readonly exchangeParser: ExchangeParser
  ) {}

  async analyzeWords(
    words: string[],
    difficultyLevel: string,
    highlightMode: string,
    vocabulary: VocabularyLists
  ): Promise<AnalysisResult> {
    const analysis: AnalysisResult = {
      totalWords: words.length,
      highlightedWords: [],
      newWords: [],
      difficultyScore: 0,
      wordFrequency: {}
    };

    const { learning: learningWords, mastered: masteredWords } = vocabulary;
    analysis.wordFrequency = this.tokenizer.countWordFrequency(words);
    const uniqueWords = this.tokenizer.getUniqueWords(words);

    const wordDataMap = await this.batchQueryWords(uniqueWords);
    const lemmasToQuery = this.collectLemmasToQuery(uniqueWords, wordDataMap);
    if (lemmasToQuery.size > 0) {
      const lemmaDataMap = await this.batchQueryWords([...lemmasToQuery]);
      lemmaDataMap.forEach((data, word) => wordDataMap.set(word, data));
    }

    for (const lowerWord of uniqueWords) {
      const originalWord = words.find((w) => w.toLowerCase() === lowerWord) ?? lowerWord;
      const wordData = wordDataMap.get(lowerWord);
      const difficultyData = this.getDifficultyData(lowerWord, wordData, wordDataMap);
      let difficulty: DifficultyResult = this.difficultyCalculator.calculateDifficulty(difficultyData, lowerWord);

      const isMastered = masteredWords.has(lowerWord);
      const isLearning = learningWords.has(lowerWord);

      if (isLearning) {
        difficulty = { ...this.difficultyCalculator.EXPERT_DIFFICULTY, info: difficulty.info };
      }

      const isHighlighted =
        !isMastered &&
        (isLearning ||
          this.difficultyCalculator.shouldHighlight(lowerWord, difficulty, highlightMode, learningWords, difficultyLevel));

      if (isHighlighted) {
        analysis.highlightedWords.push({
          word: originalWord,
          difficulty,
          frequency: analysis.wordFrequency[lowerWord] ?? 0,
          wordData
        });
        if (!learningWords.has(lowerWord)) {
          analysis.newWords.push(lowerWord);
        }
      }

      analysis.difficultyScore += difficulty.score;
    }

    analysis.difficultyScore = uniqueWords.length > 0 ? Math.round(analysis.difficultyScore / uniqueWords.length) : 0;
    return analysis;
  }

  async batchQueryWords(words: string[]): Promise<Map<string, WordInfo>> {
    const wordDataMap = new Map<string, WordInfo>();
    const results = await this.dataStorage.queryWordsBatch(words);
    for (const result of results) {
      if (result.data) wordDataMap.set(result.word, result.data);
    }
    return wordDataMap;
  }

  /** 收集需要补查的原形（自身无元数据但有 exchange） */
  collectLemmasToQuery(uniqueWords: string[], wordDataMap: Map<string, WordInfo>): Set<string> {
    const lemmas = new Set<string>();
    for (const lowerWord of uniqueWords) {
      const wordData = wordDataMap.get(lowerWord);
      if (wordData && !this.difficultyCalculator.hasMetadata(wordData) && wordData.exchange) {
        const lemma = this.exchangeParser.getLemma(wordData.exchange);
        if (lemma && lemma.toLowerCase() !== lowerWord) {
          const lemmaLower = lemma.toLowerCase();
          if (!wordDataMap.has(lemmaLower)) lemmas.add(lemmaLower);
        }
      }
    }
    return lemmas;
  }

  /** 自身无元数据时回退到原形的元数据 */
  getDifficultyData(
    lowerWord: string,
    wordData: WordInfo | undefined,
    wordDataMap: Map<string, WordInfo>
  ): WordInfo | undefined {
    if (wordData && !this.difficultyCalculator.hasMetadata(wordData) && wordData.exchange) {
      const lemma = this.exchangeParser.getLemma(wordData.exchange);
      if (lemma && lemma.toLowerCase() !== lowerWord) {
        const lemmaData = wordDataMap.get(lemma.toLowerCase());
        if (lemmaData && this.difficultyCalculator.hasMetadata(lemmaData)) return lemmaData;
      }
    }
    return wordData;
  }
}
