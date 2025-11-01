import type { AnalyzedWord, DifficultyLevel, TextAnalysisResult } from '../types';

export class TextAnalyzerService {
  /**
   * Analyze text and return words with difficulty scores
   */
  async analyzeText(text: string, vocabulary: Set<string>): Promise<TextAnalysisResult> {
    const words = this.extractWords(text);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    
    const analyzedWords: AnalyzedWord[] = [];
    const wordMap = new Map<string, AnalyzedWord>();

    for (const word of words) {
      const lower = word.toLowerCase();
      
      if (wordMap.has(lower)) continue;

      const analyzed = await this.analyzeWord(word, vocabulary);
      analyzedWords.push(analyzed);
      wordMap.set(lower, analyzed);
    }

    const avgDifficulty = analyzedWords.length > 0
      ? analyzedWords.reduce((sum, w) => sum + w.score, 0) / analyzedWords.length
      : 0;

    return {
      text,
      words: analyzedWords,
      totalWords: words.length,
      uniqueWords: uniqueWords.size,
      averageDifficulty: avgDifficulty,
    };
  }

  /**
   * Analyze a single word and determine difficulty
   */
  private async analyzeWord(word: string, vocabulary: Set<string>): Promise<AnalyzedWord> {
    const lower = word.toLowerCase();
    const isLearning = vocabulary.has(lower);

    // If in vocabulary, mark as expert (learned)
    if (isLearning) {
      return {
        word: lower,
        original: word,
        difficulty: 'expert',
        score: 100,
        isLearning: true,
      };
    }

    // Simple difficulty estimation based on word length and common patterns
    const difficulty = this.estimateDifficulty(lower);
    const score = this.difficultyToScore(difficulty);

    return {
      word: lower,
      original: word,
      difficulty,
      score,
      isLearning: false,
    };
  }

  /**
   * Estimate difficulty based on word characteristics
   */
  private estimateDifficulty(word: string): DifficultyLevel {
    // Common words (high frequency)
    const commonWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
      'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
      'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
      'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
      'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
      'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
      'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    ]);

    if (commonWords.has(word)) {
      return 'beginner';
    }

    const length = word.length;

    // Very short words tend to be easier
    if (length <= 3) return 'beginner';
    if (length <= 6) return 'intermediate';
    if (length <= 10) return 'advanced';
    
    // Long words tend to be harder
    return 'expert';
  }

  /**
   * Convert difficulty level to numeric score
   */
  private difficultyToScore(difficulty: DifficultyLevel): number {
    switch (difficulty) {
      case 'beginner': return 25;
      case 'intermediate': return 50;
      case 'advanced': return 75;
      case 'expert': return 100;
      default: return 50;
    }
  }

  /**
   * Extract words from text (only alphabetic words)
   */
  private extractWords(text: string): string[] {
    // Match words (including hyphenated and apostrophes)
    const wordPattern = /[a-zA-Z]+(?:[-'][a-zA-Z]+)*/g;
    const matches = text.match(wordPattern);
    return matches || [];
  }

  /**
   * Get difficulty color class
   */
  getDifficultyClass(difficulty: DifficultyLevel): string {
    return `difficulty-${difficulty}`;
  }

  /**
   * Get difficulty color
   */
  getDifficultyColor(difficulty: DifficultyLevel): string {
    const colors = {
      beginner: '#7ED321',      // Green
      intermediate: '#F5A623',  // Orange
      advanced: '#D0021B',      // Red
      expert: '#9013FE',        // Purple
    };
    return colors[difficulty];
  }
}
