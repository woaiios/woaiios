/**
 * Analysis Slice
 * Manages text analysis state
 */

import type { TextAnalysisResult, WordInfo } from '../../types';

export interface AnalysisSlice {
  currentText: string;
  analysisResult: TextAnalysisResult | null;
  selectedWord: WordInfo | null;
  isAnalyzing: boolean;
  setCurrentText: (text: string) => void;
  setAnalysisResult: (result: TextAnalysisResult | null) => void;
  setSelectedWord: (word: WordInfo | null) => void;
  setIsAnalyzing: (loading: boolean) => void;
}

export const createAnalysisSlice = (set: any): AnalysisSlice => ({
  currentText: '',
  analysisResult: null,
  selectedWord: null,
  isAnalyzing: false,
  
  setCurrentText: (text: string) => set({ currentText: text }),
  setAnalysisResult: (result: TextAnalysisResult | null) => set({ analysisResult: result }),
  setSelectedWord: (word: WordInfo | null) => set({ selectedWord: word }),
  setIsAnalyzing: (loading: boolean) => set({ isAnalyzing: loading }),
});
