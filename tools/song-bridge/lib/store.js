'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDir, readJsonSafe, writeJsonAtomic } = require('./util');

/**
 * 歌曲缓存：元数据 + MP3 文件
 * 目录结构：
 *   cache/index.json       所有歌曲的元数据（LRU 有序）
 *   cache/audio/<key>.mp3  音频文件
 */
class SongStore {
  constructor({ cacheDir, audioDir, maxSongs = 200, maxBytes = 2 * 1024 * 1024 * 1024 }) {
    this.cacheDir = cacheDir;
    this.audioDir = audioDir;
    this.maxSongs = maxSongs;
    this.maxBytes = maxBytes;
    this.indexFile = path.join(cacheDir, 'index.json');
    ensureDir(cacheDir);
    ensureDir(audioDir);
    this._index = readJsonSafe(this.indexFile, { songs: [] }) || { songs: [] };
    if (!Array.isArray(this._index.songs)) this._index.songs = [];
  }

  audioPath(key) {
    return path.join(this.audioDir, `${key}.mp3`);
  }

  get(key) {
    const song = this._index.songs.find((s) => s.id === key);
    if (!song) return null;
    if (!fs.existsSync(this.audioPath(key))) return null;
    return song;
  }

  has(key) {
    return !!this.get(key);
  }

  /** 取出并置顶（LRU） */
  touch(key) {
    const i = this._index.songs.findIndex((s) => s.id === key);
    if (i === -1) return null;
    const [song] = this._index.songs.splice(i, 1);
    song.lastPlayedAt = Date.now();
    this._index.songs.unshift(song);
    this._flush();
    return song;
  }

  put(key, meta) {
    const existing = this._index.songs.findIndex((s) => s.id === key);
    const record = {
      id: key,
      ...meta,
      createdAt: meta.createdAt || Date.now(),
      lastPlayedAt: Date.now()
    };
    if (existing >= 0) this._index.songs.splice(existing, 1);
    this._index.songs.unshift(record);
    this._evict();
    this._flush();
    return record;
  }

  remove(key) {
    const before = this._index.songs.length;
    this._index.songs = this._index.songs.filter((s) => s.id !== key);
    const file = this.audioPath(key);
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (_) {}
    }
    this._flush();
    return before !== this._index.songs.length;
  }

  list() {
    return this._index.songs.filter((s) => fs.existsSync(this.audioPath(s.id)));
  }

  clear() {
    for (const s of this._index.songs) {
      const file = this.audioPath(s.id);
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (_) {}
      }
    }
    this._index.songs = [];
    this._flush();
  }

  bytes() {
    return this.list().reduce((sum, s) => {
      try {
        return sum + fs.statSync(this.audioPath(s.id)).size;
      } catch (_) {
        return sum;
      }
    }, 0);
  }

  _evict() {
    while (this._index.songs.length > this.maxSongs) {
      const victim = this._index.songs.pop();
      if (victim) this._deleteAudio(victim.id);
    }
    let guard = 0;
    while (this.bytes() > this.maxBytes && this._index.songs.length > 1 && guard++ < 50) {
      const victim = this._index.songs.pop();
      if (victim) this._deleteAudio(victim.id);
    }
  }

  _deleteAudio(key) {
    const file = this.audioPath(key);
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (_) {}
    }
  }

  _flush() {
    writeJsonAtomic(this.indexFile, this._index);
  }
}

module.exports = { SongStore };
