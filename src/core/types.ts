/**
 * core/types — 领域层共享类型（纯数据，无 DOM / 无副作用）
 */

export interface WordInfo {
  word?: string;
  phonetic?: string;
  translation?: string;
  definition?: string;
  exchange?: string;
  tag?: string;
  collins?: number;
  oxford?: number | boolean;
  bnc?: number;
  frq?: number;
  [key: string]: unknown;
}

export type DifficultyLevel = 'common' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface DifficultyResult {
  level: DifficultyLevel;
  score: number;
  className: string;
  info: WordInfo | null;
}

export interface HighlightedWord {
  word: string;
  difficulty: DifficultyResult;
  frequency: number;
  wordData: WordInfo | undefined;
  translation?: string;
  phonetic?: string;
}

export interface AnalysisResult {
  totalWords: number;
  highlightedWords: HighlightedWord[];
  newWords: string[];
  difficultyScore: number;
  wordFrequency: Record<string, number>;
}

export interface VocabularyLists {
  learning: Set<string>;
  mastered: Set<string>;
}

/** 引擎唯一的数据依赖 —— UI/存储层实现它（DirectDataStorage 适配） */
export interface WordDataAccess {
  queryWordsBatch(words: string[]): Promise<Array<{ word: string; data: WordInfo | null }>>;
}
