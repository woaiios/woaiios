// Word difficulty levels
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Word information from dictionary
export interface WordInfo {
  word: string;
  phonetic?: string;
  definition?: string;
  translation?: string;
  collins?: number;
  oxford?: number;
  tag?: string;
  bnc?: number;
  frq?: number;
  exchange?: string;
}

// Analyzed word with difficulty
export interface AnalyzedWord {
  word: string;
  original: string;
  difficulty: DifficultyLevel;
  score: number;
  info?: WordInfo;
  isLearning?: boolean;
}

// Vocabulary item
export interface VocabularyItem {
  word: string;
  addedAt: number;
  difficulty: DifficultyLevel;
  status: 'learning' | 'mastered'; // Learning or mastered status
  notes?: string;
  phonetic?: string; // Phonetic transcription
  translation?: string; // Chinese translation
}

// Settings
export interface AppSettings {
  difficultyLevel: DifficultyLevel;
  highlightMode: 'all' | 'unknown' | 'none';
  showTranslation: boolean;
  autoSave: boolean;
}

// Text analysis result
export interface TextAnalysisResult {
  text: string;
  words: AnalyzedWord[];
  totalWords: number;
  uniqueWords: number;
  averageDifficulty: number;
}
