'use strict';

/**
 * 风格路由器
 * -----------------------------------------------------------------------------
 * 按 WorkBuddy「music-caption-rewriter」技能的方法做渐进式检索：
 *   1. 读 references/genre-router.md 得到风格家族映射
 *   2. 命中一个主家族，只打开那一个 family index
 *   3. 在 index 的紧凑卡片里挑 1 个 Foundation 参考
 *   4. 只读那一张卡对应的完整模板文件，作为写 caption 的参考
 *
 * 技能原本是给交互式 Agent 用的（靠读文件做取舍），这里把同样的流程自动化，
 * 只把最终选中的模板喂给本地 27B 模型，避免一次性塞进 1000 个模板。
 */

const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'with', 'for', 'to', 'in', 'on', 'at', 'by',
  'is', 'are', 'was', 'were', 'be', 'it', 'its', 'that', 'this', 'these', 'those',
  'song', 'music', 'track', 'piece', 'style', 'feel', 'feels', 'sound', 'sounds',
  'very', 'more', 'most', 'some', 'like', 'about', 'into', 'from', 'than', 'then'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t.length > 2 && !STOPWORDS.has(t));
}

function parseMarkdownRows(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim().replace(/^`(.*)`$/, '$1'));
    if (!cells.length) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // 分隔行
    rows.push(cells);
  }
  return rows;
}

class StyleRouter {
  constructor(cfg) {
    this.cfg = cfg;
    this.refDir = path.join(cfg.dir, 'references');
    this.tplDir = path.join(cfg.dir, 'templates');
    this._routes = null;
    this._indexCache = new Map();
  }

  get available() {
    return this.cfg.enabled && fs.existsSync(this.refDir) && fs.existsSync(this.tplDir);
  }

  /** 从 genre-router.md 解析 家族 -> index 文件 以及其正向线索 */
  loadRoutes() {
    if (this._routes) return this._routes;
    const file = path.join(this.refDir, 'genre-router.md');
    if (!fs.existsSync(file)) {
      this._routes = [];
      return this._routes;
    }
    const md = fs.readFileSync(file, 'utf8');
    const rows = parseMarkdownRows(md).filter((r) => r.length >= 4);
    const routes = [];
    for (const row of rows) {
      const route = row[0];
      const cues = row[1] || '';
      const indexCell = row[3] || '';
      const m = indexCell.match(/\(([^)]+\.md)\)/) || indexCell.match(/(index-[a-z0-9-]+\.md)/);
      if (!route || route === 'Route' || !m) continue;
      routes.push({ route, cues, index: m[1] });
    }
    this._routes = routes;
    return routes;
  }

  /** 依据用户给的曲风描述选出主家族 */
  pickRoute(styleText) {
    const routes = this.loadRoutes();
    if (!routes.length) return null;
    const tokens = tokenize(styleText);
    if (!tokens.length) {
      return routes.find((r) => r.route === 'general-pop-ballad') || routes[routes.length - 1];
    }
    let best = null;
    let bestScore = 0;
    for (const r of routes) {
      const hay = tokenize(`${r.route} ${r.cues}`);
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 3;
        else if (hay.some((h) => h.startsWith(t) || t.startsWith(h))) score += 1;
      }
      // route 名字本身直接命中（如用户写 "lo-fi hip-hop"）权重更高
      const routeTokens = tokenize(r.route);
      for (const t of tokens) if (routeTokens.includes(t)) score += 4;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return best || routes.find((r) => r.route === 'general-pop-ballad') || routes[0];
  }

  /** 读取某个家族的紧凑卡片列表 */
  loadIndex(indexFile) {
    if (this._indexCache.has(indexFile)) return this._indexCache.get(indexFile);
    const file = path.join(this.refDir, indexFile);
    let cards = [];
    if (fs.existsSync(file)) {
      const rows = parseMarkdownRows(fs.readFileSync(file, 'utf8'));
      for (const row of rows) {
        if (row.length < 8) continue;
        const [id, style, secondary, tempo, mood, vocal, palette, tpl] = row;
        if (!id || id === 'ID') continue;
        cards.push({ id, style, secondary, tempo, mood, vocal, palette, template: tpl });
      }
    }
    this._indexCache.set(indexFile, cards);
    return cards;
  }

  /**
   * 挑一张 Foundation 参考卡并读出完整模板
   * @param {string} styleText 用户曲风描述
   * @returns {{route: string, card: object|null, template: string|null}}
   */
  resolve(styleText) {
    if (!this.available) return { route: null, card: null, template: null };
    const route = this.pickRoute(styleText);
    if (!route) return { route: null, card: null, template: null };

    const cards = this.loadIndex(route.index);
    if (!cards.length) return { route: route.route, card: null, template: null };

    const tokens = tokenize(styleText);
    let best = cards[0];
    let bestScore = -1;
    for (const card of cards) {
      let score = 0;
      const styleTokens = tokenize(card.style);
      for (const t of tokens) {
        if (styleTokens.includes(t)) score += 5;
        else if (tokenize(card.palette).includes(t)) score += 2;
        else if (tokenize(card.mood).includes(t)) score += 1;
      }
      // 主题无关的轻微扰动，保证同一输入稳定，不同输入有变化
      score += (hashString(card.id) % 3) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }

    let template = null;
    const tplPath = path.join(this.cfg.dir, best.template || '');
    if (best.template && fs.existsSync(tplPath)) {
      template = fs.readFileSync(tplPath, 'utf8').trim();
    }
    return { route: route.route, card: best, template };
  }
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

module.exports = { StyleRouter };
