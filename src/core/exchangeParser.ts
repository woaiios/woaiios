/**
 * core/exchangeParser — ECDICT exchange 字段（词形变化）解析
 */

export interface WordForms {
  p: string | null; // 过去式
  d: string | null; // 过去分词
  i: string | null; // 现在分词
  '3': string | null; // 第三人称单数
  r: string | null; // 比较级
  t: string | null; // 最高级
  s: string | null; // 复数
  '0': string | null; // 原形（主 lemma）
  '1': string | null; // 备选 lemma
}

export class ExchangeParser {
  readonly LEMMA_KEY = '0';
  readonly LEMMA_VARIATION_KEY = '1';

  readonly FORM_LABELS: Record<string, string> = {
    p: '过去式',
    d: '过去分词',
    i: '现在分词',
    '3': '第三人称单数',
    r: '比较级',
    t: '最高级',
    s: '复数',
    '0': '原形'
  };

  /** 解析 "type:value/type:value" 形式的 exchange 字段 */
  parseExchange(exchange?: string | null): WordForms {
    const forms: WordForms = { p: null, d: null, i: null, '3': null, r: null, t: null, s: null, '0': null, '1': null };
    if (!exchange) return forms;

    for (const pair of exchange.split('/')) {
      const [type, value] = pair.split(':');
      if (type && value) {
        forms[type as keyof WordForms] = value;
      }
    }
    return forms;
  }

  /** 格式化为 "标签: 值 | ..."（固定键序） */
  formatWordForms(exchange?: string | null): string {
    if (!exchange) return '';
    const forms = this.parseExchange(exchange);
    const valid: string[] = [];
    for (const [key, value] of Object.entries(forms)) {
      const label = this.FORM_LABELS[key];
      if (value && label) valid.push(`${label}: ${value}`);
    }
    return valid.join(' | ');
  }

  /** 取原形（优先 0，其次 1） */
  getLemma(exchange?: string | null): string | null {
    if (!exchange) return null;
    const forms = this.parseExchange(exchange);
    return forms[this.LEMMA_KEY] || forms[this.LEMMA_VARIATION_KEY] || null;
  }
}
