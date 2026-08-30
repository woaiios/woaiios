import { describe, it, expect } from 'vitest';
import { WordTokenizer } from '../tokenizer';

describe('WordTokenizer.extractWords', () => {
  const t = new WordTokenizer();

  it('returns [] for empty input', () => {
    expect(t.extractWords('')).toEqual([]);
  });

  it('drops single-letter tokens and non-Latin words', () => {
    expect(t.extractWords('a b c')).toEqual([]);
    expect(t.extractWords('你好 world hello')).toEqual(['world', 'hello']);
  });

  it('strips punctuation and keeps pure Latin words >1 char', () => {
    // 'I' 被长度过滤掉；'am' 是合法两字母词（与原版 Intl.Segmenter 行为一致）
    expect(t.extractWords('Hello, world! I am fine.')).toEqual(['Hello', 'world', 'am', 'fine']);
  });

  it('excludes contractions and digits', () => {
    const words = t.extractWords("it's don't abc123 okay");
    expect(words).toContain('okay');
    expect(words).not.toContain('abc123');
    expect(words.join(' ')).not.toMatch(/'/);
  });
});

describe('WordTokenizer.countWordFrequency', () => {
  const t = new WordTokenizer();

  it('counts case-insensitively with lowercase keys', () => {
    expect(t.countWordFrequency(['Hello', 'hello', 'WORLD', 'world'])).toEqual({ hello: 2, world: 2 });
  });

  it('returns {} for empty list', () => {
    expect(t.countWordFrequency([])).toEqual({});
  });
});

describe('WordTokenizer.getUniqueWords', () => {
  const t = new WordTokenizer();

  it('dedupes case-insensitively, preserving first-seen order', () => {
    expect(t.getUniqueWords(['Apple', 'apple', 'Banana', 'banana'])).toEqual(['apple', 'banana']);
  });
});

describe('WordTokenizer.splitTextByWords', () => {
  const t = new WordTokenizer();

  it('parts join back to the original text', () => {
    const text = 'Hello, world! This is a test.';
    expect(t.splitTextByWords(text).join('')).toBe(text);
  });

  it('keeps words as separate parts', () => {
    const parts = t.splitTextByWords('Hello, world!');
    expect(parts).toContain('Hello');
    expect(parts).toContain('world');
  });
});

describe('WordTokenizer.isWord', () => {
  const t = new WordTokenizer();

  it('accepts pure Latin words longer than one character', () => {
    expect(t.isWord('hello')).toBe(true);
    expect(t.isWord('a')).toBe(false);
    expect(t.isWord('héllo')).toBe(false);
    expect(t.isWord('abc123')).toBe(false);
  });
});
