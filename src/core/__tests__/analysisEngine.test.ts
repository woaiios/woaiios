import { describe, it, expect } from 'vitest';
import { WordAnalysisEngine } from '../analysisEngine';
import { WordTokenizer } from '../tokenizer';
import { DifficultyCalculator } from '../difficultyCalculator';
import { ExchangeParser } from '../exchangeParser';
import type { WordInfo } from '../types';

/** 内存版 WordDataAccess —— 引擎唯一的数据依赖，便于单测 */
class FakeStorage {
  constructor(private rows: Record<string, Record<string, unknown>>) {}
  async queryWordsBatch(words: string[]) {
    return words.map((word) => ({ word, data: this.rows[word] ?? null }));
  }
}

function makeEngine(rows: Record<string, Record<string, unknown>>) {
  return new WordAnalysisEngine(
    new FakeStorage(rows),
    new WordTokenizer(),
    new DifficultyCalculator(),
    new ExchangeParser()
  );
}

const vocab = { learning: new Set<string>(), mastered: new Set<string>() };

describe('WordAnalysisEngine.analyzeWords', () => {
  it('reports totals and frequency', async () => {
    const engine = makeEngine({});
    const result = await engine.analyzeWords(['go', 'go', 'stop'], 'common', 'all', vocab);
    expect(result.totalWords).toBe(3);
    expect(result.wordFrequency).toEqual({ go: 2, stop: 1 });
  });

  it("'all' mode highlights every non-mastered word", async () => {
    const engine = makeEngine({});
    const result = await engine.analyzeWords(['go', 'stop'], 'common', 'all', vocab);
    expect(result.highlightedWords.map((w) => w.word).sort()).toEqual(['go', 'stop']);
    expect(result.newWords.sort()).toEqual(['go', 'stop']);
  });

  it('mastered words are never highlighted', async () => {
    const engine = makeEngine({});
    const v = { learning: new Set<string>(), mastered: new Set(['stop']) };
    const result = await engine.analyzeWords(['go', 'stop'], 'common', 'all', v);
    expect(result.highlightedWords.map((w) => w.word)).toEqual(['go']);
  });

  it("learning words get expert difficulty override", async () => {
    const engine = makeEngine({});
    const v = { learning: new Set(['apple']), mastered: new Set<string>() };
    const result = await engine.analyzeWords(['apple'], 'common', 'unknown', v);
    expect(result.highlightedWords[0]?.difficulty.level).toBe('expert');
    // 学习词不算 new word
    expect(result.newWords).toEqual([]);
  });

  it("preserves original casing of the first occurrence", async () => {
    const engine = makeEngine({});
    const result = await engine.analyzeWords(['Go', 'go'], 'common', 'all', vocab);
    const go = result.highlightedWords.find((w) => w.word.toLowerCase() === 'go');
    expect(go?.word).toBe('Go');
  });

  it('averages difficulty score over unique words', async () => {
    const engine = makeEngine({});
    const result = await engine.analyzeWords(['go'], 'common', 'all', vocab);
    expect(result.difficultyScore).toBe(0); // 无数据 → common/0
  });
});

describe('WordAnalysisEngine lemma fallback', () => {
  it('uses lemma metadata when inflected form has none', async () => {
    const engine = makeEngine({
      went: { exchange: '0:go/p:went' }, // 无难度元数据，只有词形
      go: { collins: 3 } // 原形有 intermediate 元数据
    });
    // 若引擎未回退到 lemma：went = common/0 → 低于 intermediate 阈值，不高亮
    const result = await engine.analyzeWords(['went'], 'intermediate', 'difficult', vocab);
    expect(result.highlightedWords.map((w) => w.word)).toEqual(['went']);
  });

  it('collectLemmasToQuery only for words lacking metadata with exchange (and lemma not yet known)', () => {
    const engine = makeEngine({});
    // 已在 map 中的词不重复收集（与原版一致）
    const known = new Map<string, WordInfo>([
      ['went', { exchange: '0:go' }],
      ['go', { collins: 5 }]
    ]);
    expect(engine.collectLemmasToQuery(['went', 'go'], known)).toEqual(new Set());
    // 未查到的原形才进入补查集合
    const missing = new Map<string, WordInfo>([['went', { exchange: '0:go' }]]);
    expect(engine.collectLemmasToQuery(['went'], missing)).toEqual(new Set(['go']));
  });

  it('getDifficultyData returns lemma data when it carries metadata', () => {
    const engine = makeEngine({});
    const wentData: WordInfo = { exchange: '0:go/p:went' };
    const goData: WordInfo = { collins: 5 };
    const map = new Map<string, WordInfo>([
      ['went', wentData],
      ['go', goData]
    ]);
    expect(engine.getDifficultyData('went', wentData, map)).toBe(goData);
    expect(engine.getDifficultyData('went', goData, map)).toBe(goData); // 自身有元数据 → 原样返回
  });
});
