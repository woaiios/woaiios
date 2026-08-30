/**
 * core — 领域层入口（纯逻辑：无 DOM、无网络、无副作用，全部可单测）
 */

export * from './types';
export { WordTokenizer } from './tokenizer';
export { ExchangeParser, type WordForms } from './exchangeParser';
export { DifficultyCalculator, type HighlightMode } from './difficultyCalculator';
export { TranslationFormatter } from './translationFormatter';
export { WordAnalysisEngine } from './analysisEngine';
export { TextDisplayProcessor } from './displayProcessor';
