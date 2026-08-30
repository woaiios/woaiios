/**
 * core/displayProcessor — 展示层文本处理：把原文逐词包裹为 ruby 标注 HTML（纯字符串，无 DOM）
 */

import type { AnalysisResult, HighlightedWord } from './types';
import type { WordTokenizer } from './tokenizer';
import type { TranslationFormatter } from './translationFormatter';

export class TextDisplayProcessor {
  constructor(
    private readonly tokenizer: WordTokenizer,
    private readonly translationFormatter: TranslationFormatter
  ) {}

  async processTextForDisplay(originalText: string, analysis: AnalysisResult, getTranslationFn: (word: string) => Promise<string>): Promise<string> {
    const highlightedMap = new Map(analysis.highlightedWords.map((item) => [item.word.toLowerCase(), item]));
    const parts = this.tokenizer.splitTextByWords(originalText);
    const uniqueWords = [...new Set(parts.filter((part) => this.tokenizer.isWord(part)))];

    const translationMap = await this.buildTranslationMap(analysis, uniqueWords, getTranslationFn);
    const processed = parts.map((part, index) => this.processPart(part, highlightedMap, translationMap, parts, index));
    return processed.join('');
  }

  async buildTranslationMap(
    analysis: AnalysisResult,
    uniqueWords: string[],
    getTranslationFn: (word: string) => Promise<string>
  ): Promise<Map<string, string>> {
    const translationMap = new Map<string, string>();
    for (const item of analysis.highlightedWords) {
      if (item.translation) translationMap.set(item.word.toLowerCase(), item.translation);
    }

    const needed = uniqueWords.filter((w) => !translationMap.has(w.toLowerCase()));
    if (needed.length > 0) {
      const batch = await Promise.all(needed.map((word) => getTranslationFn(word)));
      needed.forEach((word, index) => translationMap.set(word.toLowerCase(), batch[index] ?? ''));
    }
    return translationMap;
  }

  /** 取 index 周围 windowSize 内的拉丁词（小写，不含自身） */
  getContextWords(parts: string[], index: number, windowSize = 8): string[] {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(parts.length, index + windowSize + 1);
    const contextWords: string[] = [];
    for (let i = start; i < end; i++) {
      if (i === index) continue;
      const part = parts[i] ?? '';
      if (/^[a-zA-Z]+$/.test(part)) contextWords.push(part.toLowerCase());
    }
    return contextWords;
  }

  private processPart(
    part: string,
    highlightedMap: Map<string, HighlightedWord>,
    translationMap: Map<string, string>,
    parts: string[],
    index: number
  ): string {
    const lower = part.toLowerCase();
    if (!this.tokenizer.isWord(lower)) return part;

    const highlightedInfo = highlightedMap.get(lower);
    const translation = translationMap.get(lower) ?? '';
    const escapedTranslation = this.translationFormatter.escapeHtmlAttribute(translation);
    const contextWords = this.getContextWords(parts, index);

    let chineseAnnotation = '';
    if (highlightedInfo?.translation) {
      chineseAnnotation = this.translationFormatter.selectChineseTranslationForContext(part, highlightedInfo.translation, contextWords);
    }
    const escapedChinese = this.translationFormatter.escapeHtml(chineseAnnotation);

    let containerClasses = 'double-ruby word-span';
    if (highlightedInfo) containerClasses += ` highlight ${highlightedInfo.difficulty.className}`;

    let phoneticAnnotation = '&nbsp;';
    if (highlightedInfo?.phonetic) {
      phoneticAnnotation = this.translationFormatter.escapeHtml(highlightedInfo.phonetic);
    }

    const chineseRt = escapedChinese || '&nbsp;';

    return `<span class="${containerClasses}" data-word="${part}" data-token-index="${index}" data-translation="${escapedTranslation}">` +
      `<ruby class="over"><rt>${phoneticAnnotation}</rt></ruby>` +
      `<span class="base">${part}</span>` +
      `<ruby class="under"><rt>${chineseRt}</rt></ruby>` +
      `</span>`;
  }
}
