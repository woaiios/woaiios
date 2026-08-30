/**
 * core/translationFormatter — 释义格式化与上下文选义（纯逻辑，无 DOM）
 */

import type { WordInfo } from './types';
import type { ExchangeParser } from './exchangeParser';

interface SenseRule {
  keywords: string[];
  chinese: string;
}

/** 常见歧义词的本地上下文选义规则 */
const SENSE_RULES: Record<string, SenseRule[]> = {
  bank: [
    { keywords: ['money', 'account', 'loan', 'deposit', 'credit', 'financial', 'cash', 'save', 'withdraw', 'investment', 'finance'], chinese: '银行' },
    { keywords: ['river', 'water', 'lake', 'canal', 'shore', 'coast', 'mud', 'sand', 'bridge', 'stream', 'sea'], chinese: '岸/堤' },
    { keywords: ['blood', 'donate', 'organ', 'tissue', 'sperm'], chinese: '库' }
  ],
  right: [
    { keywords: ['left', 'turn', 'side', 'direction', 'go', 'move', 'walk'], chinese: '右边' },
    { keywords: ['wrong', 'correct', 'answer', 'true', 'false', 'mistake'], chinese: '正确' },
    { keywords: ['law', 'legal', 'vote', 'property', 'human'], chinese: '权利' }
  ],
  light: [
    { keywords: ['lamp', 'bulb', 'bright', 'sun', 'dark', 'shadow', 'illuminate'], chinese: '光/灯' },
    { keywords: ['heavy', 'weight', 'small', 'easy', 'basic'], chinese: '轻的' }
  ],
  current: [
    { keywords: ['electric', 'charge', 'wire', 'battery', 'voltage', 'circuit', 'flow'], chinese: '电流' },
    { keywords: ['now', 'today', 'present', 'recent', 'news', 'situation', 'latest'], chinese: '当前的' }
  ],
  set: [
    { keywords: ['collection', 'group', 'series', 'tools', 'data'], chinese: '集合/组' },
    { keywords: ['put', 'place', 'position', 'arrange', 'table'], chinese: '放置/设置' }
  ],
  run: [
    { keywords: ['race', 'jog', 'sprint', 'track', 'marathon', 'fast'], chinese: '跑' },
    { keywords: ['program', 'software', 'code', 'server', 'command', 'script'], chinese: '运行' },
    { keywords: ['management', 'business', 'company', 'organization'], chinese: '经营' }
  ],
  spring: [
    { keywords: ['season', 'weather', 'bloom', 'flower', 'warm'], chinese: '春天' },
    { keywords: ['jump', 'leap', 'bounce', 'coil'], chinese: '弹跳' },
    { keywords: ['water', 'source', 'well'], chinese: '泉' }
  ],
  charge: [
    { keywords: ['electric', 'battery', 'power', 'voltage', 'circuit', 'phone'], chinese: '充电/电荷' },
    { keywords: ['money', 'pay', 'fee', 'cost', 'price'], chinese: '费用' },
    { keywords: ['accuse', 'crime', 'police', 'court', 'law'], chinese: '指控' }
  ],
  match: [
    { keywords: ['game', 'play', 'team', 'score', 'competition', 'sport'], chinese: '比赛' },
    { keywords: ['fire', 'burn', 'light', 'cigarette'], chinese: '火柴' },
    { keywords: ['same', 'equal', 'pair', 'compare', 'fit'], chinese: '匹配/相配' }
  ],
  kind: [
    { keywords: ['type', 'sort', 'category', 'variety', 'class'], chinese: '种类' },
    { keywords: ['nice', 'friendly', 'caring', 'gentle', 'warm'], chinese: '亲切的' }
  ],
  mean: [
    { keywords: ['average', 'middle', 'median', 'number'], chinese: '平均' },
    { keywords: ['intend', 'say', 'meaning', 'refers', 'signify'], chinese: '意思是' }
  ],
  sound: [
    { keywords: ['noise', 'hear', 'music', 'voice', 'loud'], chinese: '声音' },
    { keywords: ['healthy', 'stable', 'solid', 'safe'], chinese: '健康的/合理的' }
  ],
  fine: [
    { keywords: ['okay', 'good', 'well', 'acceptable'], chinese: '好的' },
    { keywords: ['penalty', 'pay', 'court', 'money'], chinese: '罚款' }
  ],
  watch: [
    { keywords: ['clock', 'time', 'hour', 'wrist'], chinese: '手表' },
    { keywords: ['see', 'look', 'observe', 'focus', 'attention'], chinese: '观看/观察' }
  ]
};

const TAG_NAMES: Record<string, string> = {
  zk: '中考',
  gk: '高考',
  cet4: 'CET-4',
  cet6: 'CET-6',
  ielts: 'IELTS',
  toefl: 'TOEFL',
  gre: 'GRE',
  tem4: 'TEM-4',
  tem8: 'TEM-8'
};

const ENTITIES: Array<[RegExp, string]> = [
  [/&amp;/g, '&'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#039;/g, "'"]
];

function decodeEntities(text: string): string {
  let out = text;
  for (const [re, ch] of ENTITIES) out = out.replace(re, ch);
  return out;
}

export class TranslationFormatter {
  readonly maxCacheSize = 5000;
  private readonly translationCache = new Map<string, string>();

  constructor(private readonly exchangeParser: ExchangeParser) {}

  /** 由 ECDICT 数据生成词条卡片 HTML（带缓存） */
  formatTranslation(word: string, wordInfo: WordInfo | null | undefined): string {
    if (!wordInfo) {
      return `<div class="word-info">
                <h3>${word}</h3>
                <p class="no-translation">未找到释义</p>
            </div>`;
    }

    const lowerWord = word.toLowerCase();
    const cached = this.translationCache.get(lowerWord);
    if (cached) return cached;

    let html = `<div class="word-info ecdict-entry compact">`;
    html += `<h3 class="word-title">${wordInfo.word}</h3>`;
    if (wordInfo.phonetic) {
      html += `<div class="phonetic-line">/${wordInfo.phonetic}/</div>`;
    }
    if (wordInfo.translation) {
      html += `<div class="translation-compact">`;
      const lines = wordInfo.translation.split('\\n');
      const firstLine = lines[0] ? this.escapeHtml((lines[0] ?? '').trim()) : '';
      if (firstLine) html += `<p>${firstLine}</p>`;
      html += `</div>`;
    }

    html += `<div class="word-details-toggle" onclick="this.parentElement.classList.toggle('expanded')">`;
    html += `<span class="toggle-icon">▼</span> <span class="toggle-text">更多详情</span>`;
    html += `</div>`;

    html += `<div class="word-details-content">`;
    html += this.formatMetadata(wordInfo);
    html += this.formatTags(wordInfo);
    html += this.formatFullTranslation(wordInfo);
    html += this.formatDefinition(wordInfo);
    html += this.formatWordForms(wordInfo);
    html += this.formatFrequency(wordInfo);
    html += `</div>`;
    html += `</div>`;

    this.translationCache.set(lowerWord, html);
    if (this.translationCache.size > this.maxCacheSize) {
      const firstKey = this.translationCache.keys().next().value;
      if (firstKey !== undefined) this.translationCache.delete(firstKey);
    }
    return html;
  }

  formatMetadata(wordInfo: WordInfo): string {
    if (!wordInfo.collins && !wordInfo.oxford) return '';
    let html = `<div class="word-meta">`;
    if ((wordInfo.collins ?? 0) > 0) {
      html += `<span class="collins-stars">${'★'.repeat(wordInfo.collins ?? 0)}</span>`;
    }
    if (wordInfo.oxford) {
      html += `<span class="oxford-badge">Oxford 3000</span>`;
    }
    html += `</div>`;
    return html;
  }

  formatTags(wordInfo: WordInfo): string {
    if (!wordInfo.tag) return '';
    const tags = wordInfo.tag.split(' ').filter((t) => t);
    if (tags.length === 0) return '';
    let html = `<div class="word-tags">`;
    for (const tag of tags) {
      html += `<span class="tag">${TAG_NAMES[tag] ?? tag}</span>`;
    }
    html += `</div>`;
    return html;
  }

  /** 完整中文释义（跳过首行，首行已单独展示） */
  formatFullTranslation(wordInfo: WordInfo): string {
    if (!wordInfo.translation) return '';
    const lines = wordInfo.translation.split('\\n');
    if (lines.length <= 1) return '';
    let html = `<div class="translation">`;
    lines.forEach((line, index) => {
      if ((line ?? '').trim() && index > 0) {
        html += `<p>${this.escapeHtml(line ?? '')}</p>`;
      }
    });
    html += `</div>`;
    return html;
  }

  formatDefinition(wordInfo: WordInfo): string {
    if (!wordInfo.definition) return '';
    let html = `<div class="definition">`;
    html += `<h4>English Definition:</h4>`;
    for (const line of wordInfo.definition.split('\\n')) {
      if ((line ?? '').trim()) html += `<p>${this.escapeHtml(line ?? '')}</p>`;
    }
    html += `</div>`;
    return html;
  }

  formatWordForms(wordInfo: WordInfo): string {
    if (!wordInfo.exchange) return '';
    const formatted = this.exchangeParser.formatWordForms(wordInfo.exchange);
    if (!formatted) return '';
    return `<div class="word-forms">` + `<h4>词形变化:</h4>` + `<p>${formatted}</p>` + `</div>`;
  }

  formatFrequency(wordInfo: WordInfo): string {
    if (!(((wordInfo.bnc ?? 0) > 0 || (wordInfo.frq ?? 0) > 0))) return '';
    let html = `<div class="word-frequency">`;
    if ((wordInfo.bnc ?? 0) > 0) html += `<span>BNC词频: ${(wordInfo.bnc ?? 0).toLocaleString()}</span>`;
    if ((wordInfo.frq ?? 0) > 0) html += `<span>当代词频: ${(wordInfo.frq ?? 0).toLocaleString()}</span>`;
    html += `</div>`;
    return html;
  }

  /** 从词条 HTML 提取首个中文释义（纯文本扫描，替代 DOMParser） */
  extractFirstChineseTranslation(translationHtml: string): string {
    if (!translationHtml) return '';

    let fullText = '';
    const compact = translationHtml.match(/<div class="translation-compact">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
    if (compact?.[1]) {
      fullText = decodeEntities(compact[1]).trim();
    } else {
      for (const m of translationHtml.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)) {
        if (/no-translation/.test(m[1] ?? '')) continue;
        fullText = decodeEntities(m[2] ?? '').trim();
        break;
      }
    }

    if (!fullText) return '';
    const clean = fullText.replace(/^[a-zA-Z]+\.\s*/, '');
    const firstWord = clean.split(/[;；,，\s]+/)[0];
    return firstWord ?? '';
  }

  /** 依据上下文关键词选择最贴切的中文义项；无规则/无命中时回退首个释义 */
  selectChineseTranslationForContext(word: string, translationHtml: string, contextWords: string[] = []): string {
    const rules = SENSE_RULES[word.toLowerCase()];
    if (rules && contextWords.length > 0) {
      let bestRule: SenseRule | null = null;
      let bestScore = 0;
      for (const rule of rules) {
        let score = 0;
        for (const keyword of rule.keywords) {
          if (contextWords.includes(keyword)) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestRule = rule;
        }
      }
      if (bestScore > 0 && bestRule) return bestRule.chinese;
    }
    return this.extractFirstChineseTranslation(translationHtml);
  }

  /** HTML 转义（纯函数，等价于原 div.innerHTML 行为：& < >） */
  escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** HTML 属性转义（含引号） */
  escapeHtmlAttribute(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  clearCache(): void {
    this.translationCache.clear();
  }

  getCacheStats(): { size: number; maxSize: number; utilization: string } {
    return {
      size: this.translationCache.size,
      maxSize: this.maxCacheSize,
      utilization: `${((this.translationCache.size / this.maxCacheSize) * 100).toFixed(1)}%`
    };
  }
}
