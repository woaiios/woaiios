/**
 * useTextAnalysis Hook
 * Manages text analysis logic and effects
 */

import { useEffect } from 'react';
import { TextAnalyzerService } from '../services/TextAnalyzerService';
import { useAppStore } from '../store';

const textAnalyzer = new TextAnalyzerService();

export function useTextAnalysis() {
  const {
    settings,
    vocabulary,
    currentText,
    setAnalysisResult,
    setIsAnalyzing,
  } = useAppStore();

  // Analyze text function
  const analyzeText = async (): Promise<void> => {
    if (!currentText.trim()) {
      setAnalysisResult(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const vocabSet = new Set<string>(vocabulary.map(v => v.word.toLowerCase()));
      const result = await textAnalyzer.analyzeText(currentText, vocabSet);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Error analyzing text:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-analyze when settings change
  useEffect(() => {
    if (currentText.trim()) {
      analyzeText();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.difficultyLevel, settings.highlightMode]);

  // Debounced analysis on text change
  useEffect(() => {
    if (!currentText.trim()) {
      setAnalysisResult(null);
      return;
    }

    const timer = setTimeout(() => {
      analyzeText();
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentText, vocabulary]);

  return { analyzeText };
}
