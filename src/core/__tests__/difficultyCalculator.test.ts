import { describe, it, expect } from 'vitest';
import { DifficultyCalculator } from '../difficultyCalculator';
import type { DifficultyResult } from '../types';

const calc = new DifficultyCalculator();

describe('DifficultyCalculator.hasMetadata', () => {
  it('detects oxford / collins / bnc / exam-tag signals', () => {
    expect(calc.hasMetadata({ oxford: 1 })).toBe(true);
    expect(calc.hasMetadata({ oxford: true as unknown as number })).toBe(true);
    expect(calc.hasMetadata({ collins: 3 })).toBe(true);
    expect(calc.hasMetadata({ bnc: 5000 })).toBe(true);
    expect(calc.hasMetadata({ tag: 'cet4 gk' })).toBe(true);
    expect(calc.hasMetadata({ tag: 'ielts toefl gre zk' })).toBe(true);
  });

  it('returns false for empty/missing signals', () => {
    expect(calc.hasMetadata({})).toBe(false);
    expect(calc.hasMetadata(null as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe('DifficultyCalculator.calculateDifficulty', () => {
  it('unknown word (no data) → common/0, info null', () => {
    expect(calc.calculateDifficulty(undefined, 'foo')).toEqual({
      level: 'common',
      score: 0,
      className: 'common',
      info: null
    });
  });

  it('oxford → common/0', () => {
    expect(calc.calculateDifficulty({ oxford: 1 }, 'go')).toMatchObject({ level: 'common', score: 0 });
  });

  it('collins 5 → common/10; collins 4 → beginner/25', () => {
    expect(calc.calculateDifficulty({ collins: 5 }, 'w')).toMatchObject({ level: 'common', score: 10 });
    expect(calc.calculateDifficulty({ collins: 4 }, 'w')).toMatchObject({ level: 'beginner', score: 25 });
  });

  it('zk/gk/cet4 tags → beginner/25; cet6 → intermediate/50', () => {
    expect(calc.calculateDifficulty({ tag: 'zk' }, 'w')).toMatchObject({ level: 'beginner', score: 25 });
    expect(calc.calculateDifficulty({ tag: 'cet6' }, 'w')).toMatchObject({ level: 'intermediate', score: 50 });
  });

  it('collins 1-3 / ielts / toefl → advanced/75 (when no higher signal)', () => {
    expect(calc.calculateDifficulty({ collins: 2 }, 'w')).toMatchObject({ level: 'advanced', score: 75 });
    expect(calc.calculateDifficulty({ tag: 'ielts' }, 'w')).toMatchObject({ level: 'advanced', score: 75 });
  });

  it('bnc bands: <20k common/15, <50k beginner/30, <100k intermediate/55', () => {
    expect(calc.calculateDifficulty({ bnc: 10000 }, 'w')).toMatchObject({ level: 'common', score: 15 });
    expect(calc.calculateDifficulty({ bnc: 40000 }, 'w')).toMatchObject({ level: 'beginner', score: 30 });
    expect(calc.calculateDifficulty({ bnc: 90000 }, 'w')).toMatchObject({ level: 'intermediate', score: 55 });
  });

  it('no signal at all → common/0 (not expert)', () => {
    expect(calc.calculateDifficulty({}, 'w')).toMatchObject({ level: 'common', score: 0 });
  });

  it('returns info = wordInfo on hit', () => {
    const info = { collins: 3 };
    expect(calc.calculateDifficulty(info, 'w').info).toBe(info);
  });
});

describe('DifficultyCalculator.shouldHighlight', () => {
  const learning = new Set(['apple']);
  const easy: DifficultyResult = { level: 'common', score: 0, className: 'common', info: null };
  const hard: DifficultyResult = { level: 'advanced', score: 75, className: 'advanced', info: null };

  it("'all' mode highlights everything", () => {
    expect(calc.shouldHighlight('x', easy, 'all', learning, 'common')).toBe(true);
  });

  it("'difficult' mode: word index >= user threshold", () => {
    expect(calc.shouldHighlight('x', hard, 'difficult', learning, 'intermediate')).toBe(true);
    expect(calc.shouldHighlight('x', easy, 'difficult', learning, 'advanced')).toBe(false);
  });

  it("'unknown' mode: difficult AND not in learning list", () => {
    expect(calc.shouldHighlight('banana', hard, 'unknown', learning, 'common')).toBe(true);
    expect(calc.shouldHighlight('apple', hard, 'unknown', learning, 'common')).toBe(false);
  });

  it("unknown mode → false", () => {
    expect(calc.shouldHighlight('x', hard, 'weird-mode', learning, 'common')).toBe(false);
  });
});

describe('DifficultyCalculator distribution & average', () => {
  it('calculateDifficultyDistribution buckets by level', () => {
    const dist = calc.calculateDifficultyDistribution([{ oxford: 1 }, { tag: 'cet4' }, {}]);
    expect(dist).toEqual({ common: 2, beginner: 1, intermediate: 0, advanced: 0, expert: 0 });
  });

  it('calculateAverageScore rounds, empty → 0', () => {
    expect(calc.calculateAverageScore([])).toBe(0);
    expect(calc.calculateAverageScore([{ score: 25 }, { score: 50 }])).toBe(38);
  });
});
