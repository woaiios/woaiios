import { describe, it, expect } from 'vitest';
import { TextDisplayProcessor } from '../displayProcessor';
import { WordTokenizer } from '../tokenizer';
import { TranslationFormatter } from '../translationFormatter';
import { ExchangeParser } from '../exchangeParser';
import type { AnalysisResult } from '../types';

function makeProcessor() {
  return new TextDisplayProcessor(new WordTokenizer(), new TranslationFormatter(new ExchangeParser()));
}

const analysis: AnalysisResult = {
  highlightedWords: [
    {
      word: 'bank',
      difficulty: { level: 'advanced', score: 75, className: 'advanced', info: null },
      frequency: 1,
      wordData: undefined,
      translation: '<div class="translation-compact"><p>n. 银行；v. 搬运</p></div>',
      phonetic: 'bæŋk'
    }
  ],
  newWords: ['bank'],
  difficultyScore: 75,
  wordFrequency: { bank: 1 },
  totalWords: 2
};

const noTranslate = async (word: string) => `<p>${word}</p>`;

describe('TextDisplayProcessor.processTextForDisplay', () => {
  it('wraps every word in a double-ruby span with data attributes', async () => {
    const out = await makeProcessor().processTextForDisplay('I love bank.', analysis, noTranslate);
    expect(out).toContain('data-word="bank"');
    expect(out).toContain('double-ruby word-span');
    expect(out).toContain('<span class="base">bank</span>');
  });

  it('adds highlight + difficulty class only for highlighted words', async () => {
    const out = await makeProcessor().processTextForDisplay('I love bank.', analysis, noTranslate);
    expect(out).toMatch(/class="double-ruby word-span highlight advanced"/);
    expect(out).not.toMatch(/class="double-ruby word-span highlight common"/);
  });

  it('shows phonetic and first Chinese sense for highlighted words', async () => {
    const out = await makeProcessor().processTextForDisplay('I love bank.', analysis, noTranslate);
    expect(out).toContain('<rt>bæŋk</rt>');
    expect(out).toContain('银行');
  });

  it('uses &nbsp; placeholders when phonetic/annotation missing', async () => {
    const bare = {
      ...analysis,
      highlightedWords: [{ word: 'bank', difficulty: analysis.highlightedWords[0]!.difficulty, frequency: 1, wordData: undefined }]
    };
    const out = await makeProcessor().processTextForDisplay('I love bank.', bare, noTranslate);
    expect(out).toContain('<rt>&nbsp;</rt>');
  });

  it('keeps non-word parts (punctuation/spaces) untouched', async () => {
    const out = await makeProcessor().processTextForDisplay('a, b c.', analysis, noTranslate);
    expect(out).toContain(', ');
    expect(out.endsWith('.')).toBe(true);
  });

  it('joins processed parts back into a single string', async () => {
    const out = await makeProcessor().processTextForDisplay('bank and river.', analysis, noTranslate);
    // base 文本拼接后应还原原文（span �?base 保留原词�?    expect(out.replace(/<[^>]+>/g, '')).toContain('bank');
    expect(out.replace(/<[^>]+>/g, '')).toContain('river');
  });
});

describe('TextDisplayProcessor.getContextWords', () => {
  const p = makeProcessor();
  const parts = ['the', ' ', 'quick', ' ', 'brown', ' ', 'fox'];

  it('collects lowercased Latin words within the window, excluding self', () => {
    expect(p.getContextWords(parts, 2)).toEqual(['the', 'brown', 'fox']);
  });

  it('clamps at text boundaries', () => {
    expect(p.getContextWords(parts, 0)).toEqual(['quick', 'brown', 'fox']);
  });
});

describe('TextDisplayProcessor.buildTranslationMap', () => {
  const p = makeProcessor();

  it('prefills highlighted words and fetches the rest via getTranslationFn', async () => {
    const calls: string[] = [];
    const fn = async (w: string) => {
      calls.push(w);
      return `<p>${w}-trans</p>`;
    };
    const map = await p.buildTranslationMap(analysis, ['bank', 'river'], fn);
    expect(map.get('bank')).toBe(analysis.highlightedWords[0]!.translation);
    expect(map.get('river')).toBe('<p>river-trans</p>');
    expect(calls).toEqual(['river']);
  });
});

