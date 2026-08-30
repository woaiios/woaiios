import { describe, it, expect } from 'vitest';
import { TranslationFormatter } from '../translationFormatter';
import { ExchangeParser } from '../exchangeParser';

const makeFormatter = () => new TranslationFormatter(new ExchangeParser());

// ECDICT 存的是字面量 "\n"（反斜杠+n），不是真换行 —— 必须保留该行为
const BANK_ENTRY = {
  word: 'bank',
  phonetic: 'bæŋk',
  translation: 'n. 银行\\nv. 搬运；储蓄',
  definition: 'a financial institution',
  exchange: '0:bank/s:banks',
  tag: 'cet4',
  collins: 5,
  oxford: 1,
  bnc: 1234
};

describe('TranslationFormatter.escapeHtmlAttribute', () => {
  it('escapes & < > " and ', () => {
    const f = makeFormatter();
    expect(f.escapeHtmlAttribute(`a&b<c>"d'e`)).toBe('a&amp;b&lt;c&gt;&quot;d&#039;e');
  });

  it('returns "" for empty input', () => {
    expect(makeFormatter().escapeHtmlAttribute('')).toBe('');
  });
});

describe('TranslationFormatter.escapeHtml (pure, no DOM)', () => {
  it('escapes & < >', () => {
    expect(makeFormatter().escapeHtml('a<b>&c>d')).toBe('a&lt;b&gt;&amp;c&gt;d');
  });
});

describe('TranslationFormatter.formatTranslation', () => {
  it('missing wordInfo → 未找到释义 block', () => {
    const html = makeFormatter().formatTranslation('nope', undefined);
    expect(html).toContain('nope');
    expect(html).toContain('未找到释义');
  });

  it('renders title, phonetic line and first translation line', () => {
    const html = makeFormatter().formatTranslation('bank', BANK_ENTRY);
    expect(html).toContain('<h3 class="word-title">bank</h3>');
    expect(html).toContain('/bæŋk/');
    expect(html).toContain('<p>n. 银行</p>');
  });

  it('renders metadata / tags / forms / frequency sections', () => {
    const html = makeFormatter().formatTranslation('bank', BANK_ENTRY);
    expect(html).toContain('★★★★★');
    expect(html).toContain('Oxford 3000');
    expect(html).toContain('CET-4');
    expect(html).toContain('词形变化');
    expect(html).toMatch(/BNC词频:\s*1[,.]234/);
  });

  it('caches by lowercase word', () => {
    const f = makeFormatter();
    const first = f.formatTranslation('Bank', BANK_ENTRY);
    const second = f.formatTranslation('bank', { ...BANK_ENTRY, phonetic: 'CHANGED' });
    expect(second).toBe(first);
    expect(f.getCacheStats().size).toBe(1);
  });
});

describe('TranslationFormatter sub-formatters', () => {
  it('formatTags maps known tags, keeps unknown as-is', () => {
    const html = makeFormatter().formatTags({ tag: 'cet4 ielts' });
    expect(html).toContain('CET-4');
    expect(html).toContain('IELTS');
    expect(makeFormatter().formatTags({ tag: 'weirdtag' })).toContain('weirdtag');
    expect(makeFormatter().formatTags({})).toBe('');
  });

  it('formatMetadata only when collins/oxford present', () => {
    expect(makeFormatter().formatMetadata({})).toBe('');
    expect(makeFormatter().formatMetadata({ oxford: 1 })).toContain('Oxford 3000');
  });

  it('formatFullTranslation skips first line, renders rest', () => {
    const f = makeFormatter();
    const html = f.formatFullTranslation(BANK_ENTRY);
    expect(html).not.toContain('<p>n. 银行</p>');
    expect(html).toContain('v. 搬运；储蓄');
    expect(f.formatFullTranslation({ translation: 'n. only-one-line' })).toBe('');
  });
});

describe('TranslationFormatter sense selection (context heuristic)', () => {
  const f = makeFormatter();
  const bankHtml = f.formatTranslation('bank', BANK_ENTRY);

  it('picks 银行 when money keywords nearby', () => {
    expect(f.selectChineseTranslationForContext('bank', bankHtml, ['money', 'loan'])).toBe('银行');
  });

  it('picks 岸/堤 when river keywords nearby', () => {
    expect(f.selectChineseTranslationForContext('bank', bankHtml, ['river', 'shore'])).toBe('岸/堤');
  });

  it('falls back to first Chinese translation without context', () => {
    expect(f.selectChineseTranslationForContext('bank', bankHtml, [])).toBe('银行');
  });

  it('word without rules → first Chinese translation', () => {
    expect(f.selectChineseTranslationForContext('apple', '<p>n. 苹果</p>', ['money'])).toBe('苹果');
  });
});

describe('TranslationFormatter.extractFirstChineseTranslation', () => {
  const f = makeFormatter();

  it('strips POS prefix and takes first sense from compact block', () => {
    expect(
      f.extractFirstChineseTranslation('<div class="translation-compact"><p>n. 银行；v. 搬运</p></div>')
    ).toBe('银行');
  });

  it('falls back to first <p> when no compact block', () => {
    expect(f.extractFirstChineseTranslation('<div><p>v. 奔跑</p></div>')).toBe('奔跑');
  });

  it('returns "" for empty / no-translation input', () => {
    expect(f.extractFirstChineseTranslation('')).toBe('');
    expect(f.extractFirstChineseTranslation('<p class="no-translation">未找到释义</p>')).toBe('');
  });
});
