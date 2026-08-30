import { describe, it, expect } from 'vitest';
import { ExchangeParser } from '../exchangeParser';

describe('ExchangeParser.parseExchange', () => {
  const p = new ExchangeParser();

  it('parses type:value pairs separated by /', () => {
    const forms = p.parseExchange('0:go/p:went/d:went/i:going/3:goes');
    expect(forms['0']).toBe('go');
    expect(forms.p).toBe('went');
    expect(forms.d).toBe('went');
    expect(forms.i).toBe('going');
    expect(forms['3']).toBe('goes');
  });

  it('returns all-null forms for empty/missing exchange', () => {
    const empty = p.parseExchange('');
    expect(Object.values(empty)).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(p.parseExchange(undefined)).toEqual(empty);
  });

  it('ignores malformed pairs (no value)', () => {
    const forms = p.parseExchange('p:went/s:');
    expect(forms.p).toBe('went');
    expect(forms.s).toBeNull();
  });
});

describe('ExchangeParser.formatWordForms', () => {
  const p = new ExchangeParser();

  it('formats known forms with Chinese labels (integer keys first, as in original)', () => {
    // JS 对象迭代顺序：整数键 '0','1','3' 在前 —— 与原版行为一致
    expect(p.formatWordForms('p:went/d:went/i:going/0:go')).toBe(
      '原形: go | 过去式: went | 过去分词: went | 现在分词: going'
    );
  });

  it('returns "" for empty exchange', () => {
    expect(p.formatWordForms('')).toBe('');
  });

  it('labels plural / comparative / superlative forms', () => {
    expect(p.formatWordForms('s:apples/r:bigger/t:biggest')).toBe('比较级: bigger | 最高级: biggest | 复数: apples');
  });
});

describe('ExchangeParser.getLemma', () => {
  const p = new ExchangeParser();

  it('prefers primary lemma (0) over variation (1)', () => {
    expect(p.getLemma('1:run/0:ran')).toBe('ran');
    expect(p.getLemma('1:ran/p:ran')).toBe('ran');
  });

  it('returns null when no lemma present', () => {
    expect(p.getLemma('p:went/i:going')).toBeNull();
    expect(p.getLemma('')).toBeNull();
  });
});
