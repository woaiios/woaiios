/**
 * SongStudioPanel — 按主文本自动作曲
 * -----------------------------------------------------------------------------
 * 曲风随机、时长按文本长度自动、长文拆多首（每首 ≤5min）
 * 直接取主页输入框文本，不再选词/选段。
 */

import { SongStudio } from '../../js/SongStudio.js';
import { NotificationManager } from '../../js/modules/NotificationManager.js';

const STYLE_PRESETS = [
    'acoustic folk pop',
    'lo-fi hip hop chill',
    'upbeat dance pop',
    'cinematic pop ballad',
    'jazz swing lounge',
    'indie rock',
    'dreamy synthwave',
    'ambient folk'
];

function pickRandomStyle() {
    return STYLE_PRESETS[Math.floor(Math.random() * STYLE_PRESETS.length)];
}

function autoDuration(text) {
    const len = (text || '').length;
    if (len < 120) return 30;
    if (len < 300) return 60;
    if (len < 600) return 90;
    if (len < 1000) return 120;
    if (len < 1800) return 180;
    if (len < 2600) return 240;
    return 300;
}

function splitIntoChunks(text) {
    const t = (text || '').trim();
    if (!t) return [];
    if (t.length <= 1500) return [t];
    const sentences = t.match(/[^.!?。！？]+[.!?。！？]+/g) || [t];
    const chunks = [];
    let cur = '';
    for (const s of sentences) {
        if ((cur + s).length > 1500 && cur) {
            chunks.push(cur.trim());
            cur = s;
        } else {
            cur += s;
        }
    }
    if (cur.trim()) chunks.push(cur.trim());
    // 兜底：仍超长的按 1500 硬切
    const out = [];
    for (const c of chunks) {
        if (c.length <= 2000) out.push(c);
        else {
            for (let i = 0; i < c.length; i += 1500) out.push(c.slice(i, i + 1500).trim());
        }
    }
    return out.filter(Boolean);
}

export class SongStudioPanel {
    constructor({ settingsManager, getMainText }) {
        this.studio = new SongStudio(settingsManager);
        this.settingsManager = settingsManager;
        this.getMainText = getMainText || (() => (document.getElementById('textInput')?.value || '').trim());

        this.mainText = '';
        this.busy = false;
        this.songs = [];
        this.streamedCaption = '';
        this.streamedLyrics = '';
        this.streamedNotes = '';
        this._cancelled = false;
    }

    render() {
        return `
            <div class="song-studio" id="songStudio">
                <div class="song-studio-header" id="songStudioToggle">
                    <div class="song-studio-title">
                        <i class="fas fa-music"></i>
                        <span>AI 歌曲 · 自动作曲</span>
                        <span class="song-studio-badge">FreeToken × ComfyUI</span>
                    </div>
                    <i class="fas fa-chevron-down song-studio-chevron" id="songStudioChevron"></i>
                </div>

                <div class="song-studio-body" id="songStudioBody">
                    <p class="song-studio-hint">
                        按主页文本自动作曲：曲风随机、时长按文本长度自动匹配，长文自动拆成多首（每首 ≤5 分钟）。
                    </p>

                    <div class="song-actions">
                        <button class="btn btn-primary" id="songGenerateBtn">
                            <i class="fas fa-music"></i>
                            <span id="songGenerateLabel">生成歌曲</span>
                        </button>
                        <button class="btn btn-secondary" id="songCancelBtn" style="display:none">
                            <i class="fas fa-times"></i> 取消
                        </button>
                        <button class="btn btn-outline" id="songStatusBtn" title="查看本地服务状态">
                            <i class="fas fa-server"></i> 服务状态
                        </button>
                    </div>

                    <div class="song-spinner" id="songLyricsSpinner" style="display:none">
                        <div class="song-spinner-icon"><i class="fas fa-spinner fa-spin"></i></div>
                        <div class="song-spinner-text">正在生成歌词...</div>
                        <div class="song-spinner-sub">Qwen3.8-27B · music-caption-rewriter</div>
                    </div>

                    <div class="song-spinner" id="songMusicSpinner" style="display:none">
                        <div class="song-spinner-icon"><i class="fas fa-spinner fa-spin"></i></div>
                        <div class="song-spinner-text">正在作曲...</div>
                        <div class="song-spinner-sub">ComfyUI · MiniMax Music 3</div>
                    </div>

                    <div class="song-status" id="songStatus" style="display:none">
                        <div class="song-status-text" id="songStatusText"></div>
                        <div class="song-progress"><div class="song-progress-bar" id="songProgressBar"></div></div>
                    </div>

                    <div class="song-lyrics" id="songLyrics" style="display:none">
                        <div class="song-lyrics-head">
                            <span><i class="fas fa-scroll"></i> 歌词</span>
                            <button class="song-lyrics-copy" id="songCopyBtn" title="复制歌词">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <pre class="song-lyrics-body" id="songLyricsBody"></pre>
                        <div class="song-notes" id="songNotes" style="display:none"></div>
                        <details class="song-caption" id="songCaptionWrap" style="display:none">
                            <summary>查看风格描述</summary>
                            <pre class="song-caption-body" id="songCaptionBody"></pre>
                        </details>
                    </div>

                    <div class="song-players" id="songPlayers" style="display:none"></div>

                    <div class="song-library" id="songLibrary" style="display:none">
                        <div class="song-library-head">
                            <span><i class="fas fa-compact-disc"></i> 已缓存</span>
                            <button class="song-library-clear" id="songClearCacheBtn">清空</button>
                        </div>
                        <div id="songLibraryList"></div>
                    </div>
                </div>
            </div>
        `;
    }

    mount() {
        const toggle = document.getElementById('songStudioToggle');
        const body = document.getElementById('songStudioBody');
        if (toggle && body) {
            toggle.addEventListener('click', () => {
                const collapsed = body.classList.toggle('collapsed');
                const chevron = document.getElementById('songStudioChevron');
                if (chevron) chevron.style.transform = collapsed ? 'rotate(-90deg)' : '';
                if (!collapsed && !this._libraryLoaded) this.refreshLibrary();
            });
        }

        document.getElementById('songGenerateBtn')?.addEventListener('click', () => this.onGenerate());
        document.getElementById('songCancelBtn')?.addEventListener('click', () => this.onCancel());
        document.getElementById('songStatusBtn')?.addEventListener('click', () => this.showServiceStatus());
        document.getElementById('songCopyBtn')?.addEventListener('click', () => this.copyLyrics());
        document.getElementById('songClearCacheBtn')?.addEventListener('click', () => this.clearCache());

        this.syncFromMainText(this.getMainText());
        this.refreshLibrary();
    }

    // 由外部同步主文本（UI 已简化，不再显示预览）
    syncFromMainText(text) {
        this.mainText = (text || '').trim();
    }

    // 兼容旧调用
    syncFromSentence(s) { this.syncFromMainText(s || this.getMainText()); }

    async onGenerate() {
        if (this.busy) return;
        const text = (this.getMainText() || '').trim();
        if (!text) {
            NotificationManager.show('请先在主页输入框粘贴要作曲的文本', 'warning');
            return;
        }
        this.mainText = text;

        const health = await this.studio.health(true);
        if (!health.ok) {
            console.warn('song-bridge not reachable, will try generate and fallback to browser mock if needed');
            this.setStatus('本地服务未连接，尝试直接生成…');
        }

        const chunks = splitIntoChunks(text);
        if (!chunks.length) {
            NotificationManager.show('文本为空', 'warning');
            return;
        }

        this._cancelled = false;
        this.startBusy();
        this.songs = [];
        this.streamedCaption = '';
        this.streamedLyrics = '';
        this.streamedNotes = '';
        this.showLyrics('');
        this.setCaption('');
        this.setNotes('');
        this.hideLyricsSpinner();
        this.hideMusicSpinner();
        const playersBox = document.getElementById('songPlayers');
        if (playersBox) { playersBox.innerHTML = ''; playersBox.style.display = 'none'; }

        const t0 = Date.now();
        let successCount = 0;

        for (let idx = 0; idx < chunks.length; idx++) {
            if (this._cancelled) break;
            const chunk = chunks[idx];
            const style = pickRandomStyle();
            const durationSec = autoDuration(chunk);
            const label = chunks.length > 1 ? `第 ${idx + 1}/${chunks.length} 首` : '生成中';

            this.setStatus(`${label}（${style} · ${durationSec}s）— 准备…`);
            this.setProgress(0);
            this.showLyricsSpinner();
            this.hideMusicSpinner();
            this.showLyrics('');
            this.streamedCaption = '';
            this.streamedLyrics = '';
            this.streamedNotes = '';
            const lyricsBody = document.getElementById('songLyricsBody');
            if (lyricsBody) lyricsBody.textContent = '';

            let song = null;
            try {
                song = await this.studio.generate(
                    { words: [], sentence: chunk, style, durationSec },
                    {
                        onStage: (d) => {
                            const lbl = STAGE_LABELS[d.stage] || d.stage;
                            this.setStatus(`${label} ${lbl}：${d.message}`);
                            if (d.stage === 'lyrics') {
                                this.showLyricsSpinner();
                                this.hideMusicSpinner();
                            }
                            if (d.stage === 'music') {
                                this.hideLyricsSpinner();
                                // 歌词已完成，先展示
                                if (this.streamedLyrics) {
                                    this.showLyrics(this.streamedLyrics);
                                }
                                this.showMusicSpinner();
                                this.setProgress(0);
                            }
                            if (d.stage === 'save') {
                                this.hideMusicSpinner();
                            }
                        },
                        onCaption: (t) => { this.streamedCaption += t; this.setCaption(this.streamedCaption); },
                        onLyrics: (t) => {
                            this.streamedLyrics += t;
                            this.hideLyricsSpinner();
                            if (lyricsBody) { lyricsBody.textContent = this.streamedLyrics; lyricsBody.scrollTop = lyricsBody.scrollHeight; }
                            const wrap = document.getElementById('songLyrics');
                            if (wrap) wrap.style.display = 'block';
                        },
                        onNotes: (t) => { this.streamedNotes += t; this.setNotes(this.streamedNotes); },
                        onProgress: (p) => { if (p.max > 0) this.setProgress(p.value / p.max); },
                        onDone: (result, cached) => {
                            this.hideLyricsSpinner();
                            this.hideMusicSpinner();
                            if (result) {
                                this.songs.push(result);
                                this.addPlayer(result, cached, idx);
                                this.showLyrics(result.lyrics || this.streamedLyrics);
                                if (result.caption) this.setCaption(result.caption);
                                if (result.notes) this.setNotes(result.notes);
                            }
                        },
                        onError: (err) => {
                            if (err.aborted) return;
                            this.hideLyricsSpinner();
                            this.hideMusicSpinner();
                            console.warn(`${label} generate error:`, err.message);
                        }
                    }
                );
            } catch (e) {
                console.warn(`chunk ${idx} exception`, e);
            }
            if (song) {
                successCount++;
                this.hideLyricsSpinner();
                this.hideMusicSpinner();
            } else if (!this._cancelled) {
                this.hideLyricsSpinner();
                this.hideMusicSpinner();
                console.warn(`chunk ${idx} fallback to browser mock`);
                const mock = this.createMockSong(chunk, style, durationSec, idx);
                this.songs.push(mock);
                this.addMockPlayer(mock, idx);
                this.showLyrics(mock.lyrics);
                this.setCaption(mock.caption);
                this.setNotes(mock.notes);
                successCount++;
            }
        }

        this.endBusy();
        if (this._cancelled) {
            this.setStatus('已取消');
            this.setProgress(0);
        } else if (successCount === 0) {
            this.setProgress(0);
        } else {
            const sec = ((Date.now() - t0) / 1000).toFixed(0);
            this.setStatus(`完成 ${successCount}/${chunks.length} 首，用时 ${sec}s`);
            this.setProgress(1);
            this.refreshLibrary();
            NotificationManager.show(`生成完成 ${successCount} 首 🎵`, 'success');
        }
    }

    onCancel() {
        this._cancelled = true;
        this.studio.cancel();
        this.endBusy();
        this.hideLyricsSpinner();
        this.hideMusicSpinner();
        this.setStatus('已取消');
    }

    showLyricsSpinner() { const el = document.getElementById('songLyricsSpinner'); if (el) el.style.display = 'flex'; }
    hideLyricsSpinner() { const el = document.getElementById('songLyricsSpinner'); if (el) el.style.display = 'none'; }
    showMusicSpinner() { const el = document.getElementById('songMusicSpinner'); if (el) el.style.display = 'flex'; }
    hideMusicSpinner() { const el = document.getElementById('songMusicSpinner'); if (el) el.style.display = 'none'; }

    startBusy() {
        this.busy = true;
        const btn = document.getElementById('songGenerateBtn');
        const label = document.getElementById('songGenerateLabel');
        const cancel = document.getElementById('songCancelBtn');
        if (btn) btn.disabled = true;
        if (label) label.textContent = '生成中…';
        if (cancel) cancel.style.display = 'inline-block';
        this.setStatus('正在连接本地服务…');
        this.setProgress(0);
    }

    endBusy() {
        this.busy = false;
        const btn = document.getElementById('songGenerateBtn');
        const label = document.getElementById('songGenerateLabel');
        const cancel = document.getElementById('songCancelBtn');
        if (btn) btn.disabled = false;
        if (label) label.textContent = '生成歌曲';
        if (cancel) cancel.style.display = 'none';
        // 兜底隐藏（正常流程已在 onDone/onError 中隐藏）
        this.hideLyricsSpinner();
        this.hideMusicSpinner();
    }

    addPlayer(song, cached, idx) {
        const box = document.getElementById('songPlayers');
        if (!box || !song) return;
        box.style.display = 'block';
        const id = `songAudio_${song.id}_${idx}`;
        const div = document.createElement('div');
        div.className = 'song-player';
        div.style.display = 'block';
        div.style.marginBottom = '10px';
        const kb = song.bytes ? `${(song.bytes / 1024 / 1024).toFixed(1)} MB` : '';
        div.innerHTML = `
            <div class="song-player-meta" style="margin-bottom:6px">
                <span class="song-meta-words">第 ${idx + 1} 首 · ${escapeHtml(song.style || '')} · ${song.durationSec || '?'}s ${kb ? '· ' + kb : ''} ${cached ? '<em class="song-tag-cache">缓存</em>' : ''}</span>
            </div>
            <audio id="${escapeAttr(id)}" controls preload="metadata"></audio>
        `;
        box.appendChild(div);
        const audio = div.querySelector('audio');
        if (audio) {
            audio.src = this.studio.audioUrl(song.id);
            audio.load();
            if (idx === 0) audio.play().catch(() => {});
        }
    }

    createMockSong(chunk, style, durationSec, idx) {
        const id = `mock-${Date.now()}-${idx}`;
        const caption = `Global Metadata: ${style}, moderate tempo 80-95 BPM, warm and clear production.\n\nVocal Details: Single warm lead vocal, mid register, clear diction.\n\nArrangement: Intro soft pad, verse sparse, chorus full, bridge stripped, outro fade. Duration ${durationSec}s.`;
        const words = chunk.replace(/\s+/g, ' ').trim().split(' ');
        const lines = [];
        for (let i = 0; i < words.length; i += 8) lines.push(words.slice(i, i + 8).join(' '));
        const body = lines.join('\n');
        const lyrics = `[Verse]\n${body.slice(0, 600)}\n[Chorus]\n${body.slice(0, 300)}\n[Outro]\n${body.slice(-200)}`;
        return { id, caption, lyrics, notes: '（浏览器内兜底生成，本地服务未连接）', style, durationSec, bytes: 0, mock: true };
    }

    addMockPlayer(mock, idx) {
        const box = document.getElementById('songPlayers');
        if (!box) return;
        box.style.display = 'block';
        const div = document.createElement('div');
        div.className = 'song-player';
        div.style.display = 'block';
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <div class="song-player-meta" style="margin-bottom:6px">
                <span class="song-meta-words">第 ${idx + 1} 首 · ${escapeHtml(mock.style)} · ${mock.durationSec}s · 浏览器内生成</span>
            </div>
            <div style="font-size:12px;color:#6b7280;padding:6px 8px;background:#f9fafb;border-radius:6px">（本地服务未连接，已用浏览器内兜底歌词展示；启动 song-bridge 后可生成真实音频）</div>
        `;
        box.appendChild(div);
    }

    showLyrics(text) {
        const wrap = document.getElementById('songLyrics');
        const body = document.getElementById('songLyricsBody');
        if (!wrap || !body) return;
        body.textContent = text || '';
        wrap.style.display = text ? 'block' : 'none';
    }

    setCaption(text) {
        const wrap = document.getElementById('songCaptionWrap');
        const body = document.getElementById('songCaptionBody');
        if (!wrap || !body) return;
        body.textContent = text || '';
        wrap.style.display = text ? 'block' : 'none';
    }

    setNotes(text) {
        const box = document.getElementById('songNotes');
        if (!box) return;
        const clean = String(text || '').trim();
        if (!clean) { box.style.display = 'none'; box.innerHTML = ''; return; }
        box.style.display = 'block';
        box.innerHTML = clean.split('\n').filter(Boolean).map(l => `<div class="song-note-line">${escapeHtml(l)}</div>`).join('');
    }

    setStatus(text) {
        const box = document.getElementById('songStatus');
        const span = document.getElementById('songStatusText');
        if (!box || !span) return;
        span.textContent = text || '';
        box.style.display = text ? 'block' : 'none';
    }

    setProgress(ratio) {
        const bar = document.getElementById('songProgressBar');
        if (!bar) return;
        bar.style.width = `${Math.max(0, Math.min(1, ratio || 0)) * 100}%`;
        bar.classList.toggle('indeterminate', !ratio);
    }

    async refreshLibrary() {
        this._libraryLoaded = true;
        const songs = await this.studio.list();
        const wrap = document.getElementById('songLibrary');
        const list = document.getElementById('songLibraryList');
        if (!wrap || !list) return;
        if (!songs.length) { wrap.style.display = 'none'; return; }
        wrap.style.display = 'block';
        list.innerHTML = songs.slice(0, 12).map(s => `
                <div class="song-library-item" data-id="${escapeAttr(s.id)}">
                    <button class="song-library-play" data-play="${escapeAttr(s.id)}" title="播放"><i class="fas fa-play"></i></button>
                    <div class="song-library-info">
                        <div class="song-library-words">${escapeHtml((s.words || []).join(' · ') || (s.sentence||'').slice(0,30))}</div>
                        <div class="song-library-sub">${escapeHtml(s.style || '')} · ${s.durationSec || '?'}s</div>
                    </div>
                    <button class="song-library-del" data-del="${escapeAttr(s.id)}" title="删除"><i class="fas fa-trash"></i></button>
                </div>`).join('');
        list.querySelectorAll('[data-play]').forEach(btn => {
            btn.addEventListener('click', () => {
                const song = songs.find(x => x.id === btn.dataset.play);
                if (song) {
                    const box = document.getElementById('songPlayers');
                    if (box) { box.innerHTML = ''; box.style.display = 'block'; }
                    this.addPlayer(song, true, 0);
                    this.setStatus('播放缓存歌曲');
                    if (song.lyrics) this.showLyrics(song.lyrics);
                }
            });
        });
        list.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await this.studio.remove(btn.dataset.del);
                this.refreshLibrary();
            });
        });
    }

    async clearCache() {
        if (!confirm('清空所有已缓存的歌曲？')) return;
        try {
            await fetch(`${this.studio.baseUrl}/api/cache`, { method: 'DELETE' });
            this.refreshLibrary();
            const box = document.getElementById('songPlayers');
            if (box) { box.innerHTML = ''; box.style.display = 'none'; }
            NotificationManager.show('缓存已清空');
        } catch (_) {
            NotificationManager.show('清空失败，服务可能未运行', 'error');
        }
    }

    async showServiceStatus() {
        const health = await this.studio.health(true);
        const box = document.getElementById('songStatus');
        const span = document.getElementById('songStatusText');
        if (!box || !span) return;
        box.style.display = 'block';
        if (!health.ok) {
            span.innerHTML = `❌ 本地歌曲服务未连接（${escapeHtml(health.error || '未知')}）。启动方式：<code>cd tools/song-bridge && npm start</code>`;
            return;
        }
        const ft = health.freetoken || {};
        const cf = health.comfyui || {};
        const lm = health.lmstudio || {};
        const gpu = health.gpu || {};
        span.innerHTML = `
            <div>FreeToken(Qwen3.8-27B)：${ft.up ? (ft.status === 'ok' ? '✅ 就绪' : `⏳ ${escapeHtml(ft.phase || ft.status || '加载中')}`) : '⭕ 未启动（点生成会自动拉起）'}</div>
            <div>ComfyUI(MiniMax Music 3)：${cf.up ? '✅ 在线' : '❌ 未连接（将使用兜底/缓存）'}</div>
            <div>LM Studio(翻译)：${(lm.loaded || []).length ? `✅ ${escapeHtml((lm.loaded || []).join(', '))}` : '⭕ 无模型常驻'}</div>
            <div>可用显存：${gpu.vramFreeGiB != null ? gpu.vramFreeGiB + ' GiB' : '未知'}${gpu.holder ? ` · 占用中：${escapeHtml(gpu.holder)}` : ''}</div>
            <div>缓存：${health.cache?.songs ?? 0} 首 · ${((health.cache?.bytes || 0) / 1024 / 1024).toFixed(1)} MB</div>
        `;
    }

    async copyLyrics() {
        const text = document.getElementById('songLyricsBody')?.textContent || '';
        if (!text) return;
        try { await navigator.clipboard.writeText(text); NotificationManager.show('歌词已复制'); } catch (_) { NotificationManager.show('复制失败', 'error'); }
    }
}

const STAGE_LABELS = { lyrics: '✍️ 写词', music: '🎼 作曲', save: '💾 保存' };
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
export default SongStudioPanel;
