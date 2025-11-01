import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DifficultyLevel,
  VocabularyItem,
  AppSettings,
  TextAnalysisResult,
  WordInfo,
} from '../types';

interface AppState {
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Vocabulary
  vocabulary: VocabularyItem[];
  addWord: (word: string, difficulty: DifficultyLevel, phonetic?: string, translation?: string) => void;
  removeWord: (word: string) => void;
  toggleWordStatus: (word: string) => void;
  clearVocabulary: () => void;
  isWordInVocabulary: (word: string) => boolean;
  getWordStatus: (word: string) => 'learning' | 'mastered' | null;

  // Text Analysis
  currentText: string;
  analysisResult: TextAnalysisResult | null;
  setCurrentText: (text: string) => void;
  setAnalysisResult: (result: TextAnalysisResult | null) => void;

  // Selected Word (for dictionary popup)
  selectedWord: WordInfo | null;
  setSelectedWord: (word: WordInfo | null) => void;

  // Loading states
  isAnalyzing: boolean;
  setIsAnalyzing: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial settings
      settings: {
        difficultyLevel: 'intermediate',
        highlightMode: 'all',
        showTranslation: true,
        autoSave: true,
      },
      updateSettings: (newSettings: Partial<AppSettings>) =>
        set((state: AppState) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Vocabulary management
      vocabulary: [],
      addWord: (word: string, difficulty: DifficultyLevel, phonetic?: string, translation?: string) =>
        set((state: AppState) => {
          const exists = state.vocabulary.some((item: VocabularyItem) => item.word.toLowerCase() === word.toLowerCase());
          if (exists) return state;
          
          return {
            vocabulary: [
              ...state.vocabulary,
              { 
                word, 
                difficulty, 
                addedAt: Date.now(),
                status: 'learning' as const,
                phonetic,
                translation,
              },
            ],
          };
        }),
      removeWord: (word: string) =>
        set((state: AppState) => ({
          vocabulary: state.vocabulary.filter(
            (item: VocabularyItem) => item.word.toLowerCase() !== word.toLowerCase()
          ),
        })),
      toggleWordStatus: (word: string) =>
        set((state: AppState) => ({
          vocabulary: state.vocabulary.map((item: VocabularyItem) =>
            item.word.toLowerCase() === word.toLowerCase()
              ? { ...item, status: item.status === 'learning' ? 'mastered' as const : 'learning' as const }
              : item
          ),
        })),
      clearVocabulary: () => set({ vocabulary: [] }),
      isWordInVocabulary: (word: string) => {
        const { vocabulary } = get();
        return vocabulary.some((item: VocabularyItem) => item.word.toLowerCase() === word.toLowerCase());
      },
      getWordStatus: (word: string) => {
        const { vocabulary } = get();
        const item = vocabulary.find((item: VocabularyItem) => item.word.toLowerCase() === word.toLowerCase());
        return item ? item.status : null;
      },

      // Text analysis
      currentText: '',
      analysisResult: null,
      setCurrentText: (text: string) => set({ currentText: text }),
      setAnalysisResult: (result: TextAnalysisResult | null) => set({ analysisResult: result }),

      // Selected word
      selectedWord: null,
      setSelectedWord: (word: WordInfo | null) => set({ selectedWord: word }),

      // Loading
      isAnalyzing: false,
      setIsAnalyzing: (loading: boolean) => set({ isAnalyzing: loading }),
    }),
    {
      name: 'word-discoverer-storage',
      partialize: (state: AppState) => ({
        settings: state.settings,
        vocabulary: state.vocabulary,
      }),
    }
  )
);
