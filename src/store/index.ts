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
  toggleWordStatus: (word: string) => void; // Toggle between learning and mastered
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
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Vocabulary management
      vocabulary: [],
      addWord: (word, difficulty, phonetic, translation) =>
        set((state) => {
          const exists = state.vocabulary.some((item) => item.word.toLowerCase() === word.toLowerCase());
          if (exists) return state;
          
          return {
            vocabulary: [
              ...state.vocabulary,
              { 
                word, 
                difficulty, 
                addedAt: Date.now(),
                status: 'learning', // Default to learning
                phonetic,
                translation,
              },
            ],
          };
        }),
      removeWord: (word) =>
        set((state) => ({
          vocabulary: state.vocabulary.filter(
            (item) => item.word.toLowerCase() !== word.toLowerCase()
          ),
        })),
      toggleWordStatus: (word) =>
        set((state) => ({
          vocabulary: state.vocabulary.map((item) =>
            item.word.toLowerCase() === word.toLowerCase()
              ? { ...item, status: item.status === 'learning' ? 'mastered' as const : 'learning' as const }
              : item
          ),
        })),
      clearVocabulary: () => set({ vocabulary: [] }),
      isWordInVocabulary: (word) => {
        const { vocabulary } = get();
        return vocabulary.some((item) => item.word.toLowerCase() === word.toLowerCase());
      },
      getWordStatus: (word) => {
        const { vocabulary } = get();
        const item = vocabulary.find((item) => item.word.toLowerCase() === word.toLowerCase());
        return item ? item.status : null;
      },

      // Text analysis
      currentText: '',
      analysisResult: null,
      setCurrentText: (text) => set({ currentText: text }),
      setAnalysisResult: (result) => set({ analysisResult: result }),

      // Selected word for dictionary
      selectedWord: null,
      setSelectedWord: (word) => set({ selectedWord: word }),

      // Loading states
      isAnalyzing: false,
      setIsAnalyzing: (loading) => set({ isAnalyzing: loading }),
    }),
    {
      name: 'word-discoverer-storage',
      partialize: (state) => ({
        settings: state.settings,
        vocabulary: state.vocabulary,
      }),
    }
  )
);
