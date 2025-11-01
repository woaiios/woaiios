/**
 * useVocabularyActions Hook
 * Manages vocabulary-related actions and handlers
 */

import { useAppStore } from '../store';
import type { DifficultyLevel, AnalyzedWord } from '../types';

export function useVocabularyActions() {
  const {
    selectedWord,
    setSelectedWord,
    addWord,
  } = useAppStore();

  const handleWordClick = (word: AnalyzedWord) => {
    setSelectedWord({
      word: word.word,
      definition: word.info?.definition || `Definition for "${word.word}"`,
      phonetic: word.info?.phonetic || `/${word.word}/`,
      translation: word.info?.translation || `${word.word} 的中文翻译`,
      collins: word.info?.collins,
      oxford: word.info?.oxford,
      tag: word.info?.tag,
      bnc: word.info?.bnc,
      frq: word.info?.frq,
    });
  };

  const handleAddToVocabulary = (word: string, difficulty: DifficultyLevel) => {
    const phonetic = selectedWord?.phonetic;
    const translation = selectedWord?.translation;
    addWord(word, difficulty, phonetic, translation);
    setSelectedWord(null);
  };

  return {
    handleWordClick,
    handleAddToVocabulary,
  };
}
