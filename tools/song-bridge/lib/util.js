'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

/** 生成缓存 key：单词集合 + 曲风 + 时长 + 种子策略 */
function songKey({ words, sentence, style, durationSec }) {
  const norm = (Array.isArray(words) ? words : [])
    .map((w) => String(w).trim().toLowerCase())
    .filter(Boolean)
    .sort();
  const base = [
    norm.join(','),
    String(sentence || '').trim().toLowerCase().slice(0, 200),
    String(style || '').trim().toLowerCase(),
    String(durationSec || '')
  ].join('|');
  return sha1(base).slice(0, 20);
}

async function fetchJson(url, { method = 'GET', body, headers, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      err.status = res.status;
      err.body = text.slice(0, 500);
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRaw(url, { method = 'GET', headers, body, timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  // timeoutMs <= 0 表示不设超时（例如长时间的模型流式生成）
  const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method,
      headers: headers || {},
      body,
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return res;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/** 解析 SSE 流：逐个 yield {event, data} */
async function* parseSse(body) {
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const parsed = parseSseBlock(raw);
      if (parsed) yield parsed;
    }
  }
  const tail = parseSseBlock(buf.trim());
  if (tail) yield tail;
}

function parseSseBlock(block) {
  if (!block || block.startsWith(':')) return null;
  let event = 'message';
  const dataLines = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join('\n');
  if (raw === '[DONE]') return { event, data: { done: true } };
  try {
    return { event, data: JSON.parse(raw) };
  } catch (_) {
    return { event, data: { raw } };
  }
}

module.exports = {
  sleep,
  sha1,
  songKey,
  fetchJson,
  fetchRaw,
  ensureDir,
  readJsonSafe,
  writeJsonAtomic,
  parseSse
};
