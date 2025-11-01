/**
 * Vocabulary Slice
 * Manages vocabulary list state and operations
 */

import type { DifficultyLevel, VocabularyItem } from '../../types';

export interface VocabularySlice {
  vocabulary: VocabularyItem[];
  addWord: (word: string, difficulty: DifficultyLevel, phonetic?: string, translation?: string) => void;
  removeWord: (word: string) => void;
  toggleWordStatus: (word: string) => void;
  clearVocabulary: () => void;
  isWordInVocabulary: (word: string) => boolean;
  getWordStatus: (word: string) => 'learning' | 'mastered' | null;
}

export const createVocabularySlice = (set: any, get: any): VocabularySlice => ({
  vocabulary: [],
  
  addWord: (word: string, difficulty: DifficultyLevel, phonetic?: string, translation?: string) =>
    set((state: any) => {
      const exists = state.vocabulary.some(
        (item: VocabularyItem) => item.word.toLowerCase() === word.toLowerCase()
      );
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
    set((state: any) => ({
      vocabulary: state.vocabulary.filter(
        (item: VocabularyItem) => item.word.toLowerCase() !== word.toLowerCase()
      ),
    })),
    
  toggleWordStatus: (word: string) =>
    set((state: any) => ({
      vocabulary: state.vocabulary.map((item: VocabularyItem) =>
        item.word.toLowerCase() === word.toLowerCase()
          ? { ...item, status: item.status === 'learning' ? 'mastered' as const : 'learning' as const }
          : item
      ),
    })),
    
  clearVocabulary: () => set({ vocabulary: [] }),
  
  isWordInVocabulary: (word: string) => {
    const { vocabulary } = get();
    return vocabulary.some(
      (item: VocabularyItem) => item.word.toLowerCase() === word.toLowerCase()
    );
  },
  
  getWordStatus: (word: string) => {
    const { vocabulary } = get();
    const item = vocabulary.find(
      (item: VocabularyItem) => item.word.toLowerCase() === word.toLowerCase()
    );
    return item ? item.status : null;
  },
});
