/**
 * useModalStates Hook
 * Manages modal visibility states
 */

import { useState } from 'react';

export interface ModalStates {
  showVocabulary: boolean;
  showSettings: boolean;
  showPronunciation: boolean;
  vocabTab: 'learning' | 'mastered';
  searchQuery: string;
}

export function useModalStates() {
  const [showVocabulary, setShowVocabulary] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showPronunciation, setShowPronunciation] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vocabTab, setVocabTab] = useState<'learning' | 'mastered'>('learning');

  return {
    showVocabulary,
    setShowVocabulary,
    showSettings,
    setShowSettings,
    showPronunciation,
    setShowPronunciation,
    searchQuery,
    setSearchQuery,
    vocabTab,
    setVocabTab,
  };
}
