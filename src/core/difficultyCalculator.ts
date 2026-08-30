/**
 * core/difficultyCalculator — 单词难度计算与高亮判定（纯逻辑）
 */

import type { DifficultyResult, WordInfo } from './types';

export type HighlightMode = 'unknown' | 'difficult' | 'all';

const DIFFICULTY_ORDER: Record<string, number> = {
  common: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
  unknown: 5
};

type AnyWordInfo = WordInfo | Record<string, unknown> | null | undefined;

export class DifficultyCalculator {
  readonly EXPERT_DIFFICULTY: Omit<DifficultyResult, 'info'> & { info?: WordInfo | null } = {
    level: 'expert',
    score: 100,
    className: 'expert'
  };

  /** 是否携带任何难度元数据信号 */
  hasMetadata(wordInfo: AnyWordInfo): boolean {
    if (!wordInfo) return false;
    const tag = typeof wordInfo.tag === 'string' ? wordInfo.tag : '';
    const collins = typeof wordInfo.collins === 'number' ? wordInfo.collins : 0;
    const bnc = typeof wordInfo.bnc === 'number' ? wordInfo.bnc : 0;
    return (
      wordInfo.oxford === 1 ||
      wordInfo.oxford === true ||
      collins > 0 ||
      bnc > 0 ||
      tag.includes('zk') ||
      tag.includes('gk') ||
      tag.includes('cet4') ||
      tag.includes('cet6') ||
      tag.includes('ielts') ||
      tag.includes('toefl') ||
      tag.includes('gre')
    );
  }

  /** 由词典数据推导难度；无数据按 common/0（不高亮）。`_word` 保留以兼容调用方签名 */
  calculateDifficulty(wordInfo: WordInfo | null | undefined, _word?: string): DifficultyResult {
    if (!wordInfo) {
      return { level: 'common', score: 0, className: 'common', info: null };
    }

    let level: DifficultyResult['level'] = 'common';
    let score = 0;
    const tag = wordInfo.tag ?? '';

    if (wordInfo.oxford === 1 || wordInfo.oxford === true) {
      level = 'common';
      score = 0;
    } else if ((wordInfo.collins ?? 0) >= 5) {
      level = 'common';
      score = 10;
    } else if ((wordInfo.collins ?? 0) >= 4 || tag.includes('zk') || tag.includes('gk') || tag.includes('cet4')) {
      level = 'beginner';
      score = 25;
    } else if ((wordInfo.collins ?? 0) >= 3 || tag.includes('cet6')) {
      level = 'intermediate';
      score = 50;
    } else if ((wordInfo.collins ?? 0) >= 1 || tag.includes('ielts') || tag.includes('toefl')) {
      level = 'advanced';
      score = 75;
    } else if ((wordInfo.bnc ?? 0) > 0 && (wordInfo.bnc ?? 0) < 20000) {
      level = 'common';
      score = 15;
    } else if ((wordInfo.bnc ?? 0) > 0 && (wordInfo.bnc ?? 0) < 50000) {
      level = 'beginner';
      score = 30;
    } else if ((wordInfo.bnc ?? 0) > 0 && (wordInfo.bnc ?? 0) < 100000) {
      level = 'intermediate';
      score = 55;
    }

    return { level, score, className: level, info: wordInfo };
  }

  /** 依据高亮模式与用户难度阈值判定是否高亮 */
  shouldHighlight(
    word: string,
    difficulty: DifficultyResult,
    highlightMode: HighlightMode | string,
    learningWords: Set<string>,
    userDifficultyLevel: string
  ): boolean {
    const UNKNOWN_INDEX = 5;
    const wordIndex = DIFFICULTY_ORDER[difficulty.level] ?? UNKNOWN_INDEX;
    const userIndex = DIFFICULTY_ORDER[userDifficultyLevel] ?? UNKNOWN_INDEX;
    const isDifficultForUser = wordIndex >= userIndex;

    switch (highlightMode) {
      case 'unknown':
        return isDifficultForUser && !learningWords.has(word);
      case 'difficult':
        return isDifficultForUser;
      case 'all':
        return true;
      default:
        return false;
    }
  }

  /** 难度分布统计 */
  calculateDifficultyDistribution(
    wordDataList: Array<WordInfo | null | undefined>
  ): Record<'common' | 'beginner' | 'intermediate' | 'advanced' | 'expert', number> {
    const distribution = { common: 0, beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
    for (const wordData of wordDataList) {
      const difficulty = this.calculateDifficulty(wordData);
      distribution[difficulty.level] += 1;
    }
    return distribution;
  }

  /** 平均难度分（四舍五入） */
  calculateAverageScore(difficulties: Array<Pick<DifficultyResult, 'score'>>): number {
    if (difficulties.length === 0) return 0;
    const total = difficulties.reduce((sum, d) => sum + d.score, 0);
    return Math.round(total / difficulties.length);
  }
}
