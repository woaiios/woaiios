/**
 * core/tokenizer — 文本分词与词频统计（纯逻辑）
 */

const LATIN_WORD = /^[a-zA-Z]+$/;

export class WordTokenizer {
  private readonly segmenter: Intl.Segmenter | null;

  constructor() {
    this.segmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter(undefined, { granularity: 'word' })
        : null;
  }

  /** 提取纯拉丁、长度>1 的单词 */
  extractWords(text: string): string[] {
    if (!text) return [];
    if (this.segmenter) {
      return Array.from(this.segmenter.segment(text))
        .filter((s) => s.isWordLike)
        .map((s) => s.segment)
        .filter((w) => w.length > 1 && LATIN_WORD.test(w));
    }
    return text
      .split(/\s+/)
      .filter((w) => w.length > 1 && LATIN_WORD.test(w));
  }

  /** 词频统计（小写键） */
  countWordFrequency(words: string[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    for (const word of words) {
      const lower = word.toLowerCase();
      frequency[lower] = (frequency[lower] ?? 0) + 1;
    }
    return frequency;
  }

  /** 去重（大小写不敏感，保留首次出现顺序） */
  getUniqueWords(words: string[]): string[] {
    return [...new Set(words.map((w) => w.toLowerCase()))];
  }

  /** 按词边界切分（用于展示层逐段包裹） */
  splitTextByWords(text: string): string[] {
    if (this.segmenter) {
      return Array.from(this.segmenter.segment(text)).map((s) => s.segment);
    }
    return text.split(/(\b[a-zA-Z-]+\b)/).filter((p) => p !== '');
  }

  /** 与 extractWords 同口径：纯拉丁且长度>1 */
  isWord(part: string): boolean {
    return LATIN_WORD.test(part) && part.length > 1;
  }
}
