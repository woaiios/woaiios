/**
 * SongStudioPanel — 单词歌曲面板
 * -----------------------------------------------------------------------------
 * 嵌在 Pronunciation 弹窗里：挑生词 → 本地 27B 写歌词 → ComfyUI 作曲 → 边下边播。
 * 生成过程全程流式：歌词一个字一个字冒出来，作曲阶段有进度条。
 */

import { SongStudio } from '../../js/SongStudio.js';
import { NotificationManager } from '../../js/modules/NotificationManager.js';

const STYLE_PRESETS = [
    { value: 'acoustic folk pop', label: '民谣流行（温暖好记）' },
    { value: 'lo-fi hip hop chill', label: 'Lo-fi 嘻哈（放松）' },
    { value: 'upbeat dance pop', label: '动感舞曲（洗脑）' },
    { value: 'cinematic pop ballad', label: '电影感抒情' },
    { value: 'jazz swing lounge', label: '爵士摇摆' },
    { value: 'indie rock', label: '独立摇滚' }
];

const DURATION_OPTIONS = [30, 60, 90, 120];

export class SongStudioPanel {
    /**
     * @param {object} options
     * @param {import('../../js/SettingsManager.js').SettingsManager} options.settingsManager
     * @param {() => string[]} options.getSuggestedWords 从页面当前高亮词里取候选
     */
    constructor({ settingsManager, getSuggestedWords }) {
        this.studio = new SongStudio(settingsManager);
        this.settingsManager = settingsManager;
        this.getSuggestedWords = getSuggestedWords || (() => []);

        this.words = [];
        this.sentence = '';
        this.busy = false;
        this.currentSong = null;
        this.streamedCaption = '';
        this.streamedLyrics = '';
        this.streamedNotes = '';
    }

    // -------------------------------------------------------------------------
    // 渲染
    // -------------------------------------------------------------------------

    render() {
        return `
            <div class="song-studio" id="songStudio">
                <div class="song-studio-header" id="songStudioToggle">
                    <div class="song-studio-title">
                        <i class="fas fa-music"></i>
                        <span>单词歌曲 · Word Song</span>
                        <span class="song-studio-badge">FreeToken × ComfyUI</span>
                    </div>
                    <i class="fas fa-chevron-down song-studio-chevron" id="songStudioChevron"></i>
                </div>

                <div class="song-studio-body" id="songStudioBody">
                    <p class="song-studio-hint">
                        选几个生词，本地 Qwen3.8-27B 写歌词，ComfyUI 用 MiniMax Music 3 谱成歌。
                        两张大模型共用一张显卡，会自动排队。
                    </p>

                    <div class="song-words-row">
                        <div class="song-word-chips" id="songWordChips"></div>
                        <div class="song-word-add">
                            <input type="text" id="songWordInput" class="form-control"
                                   placeholder="加个词，回车" maxlength="40">
                        </div>
                    </div>

                    <div class="song-controls">
                        <label class="song-field">
                            <span>曲风</span>
                            <select id="songStyleSelect" class="form-control">
                                ${STYLE_PRESETS.map(
                                    (s) =>
                                        `<option value="${s.value}">${s.label}</option>`
                                ).join('')}
                                <option value="__custom">自定义…</option>
                            </select>
                        </label>
                        <label class="song-field song-field-sm">
                            <span>时长</span>
                            <select id="songDurationSelect" class="form-control">
                                ${DURATION_OPTIONS.map(
                                    (d) => `<option value="${d}"${d === 60 ? ' selected' : ''}>${d}s</option>`
                                ).join('')}
                            </select>
                        </label>
                    </div>
                    <input type="text" id="songStyleCustom" class="form-control song-style-custom"
                           placeholder="自定义曲风，例如：dreamy synthwave with female vocals" style="display:none">

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
                            <summary>查看给模型的风格描述</summary>
                            <pre class="song-caption-body" id="songCaptionBody"></pre>
                        </details>
                    </div>

                    <div class="song-player" id="songPlayer" style="display:none">
                        <audio id="songAudioEl" controls preload="metadata"></audio>
                        <div class="song-player-meta" id="songPlayerMeta"></div>
                    </div>

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

    /** 面板挂载后绑定事件 */
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

        const wordInput = document.getElementById('songWordInput');
        if (wordInput) {
            wordInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                this.addWord(wordInput.value);
                wordInput.value = '';
            });
            wordInput.addEventListener('blur', () => {
                if (wordInput.value.trim()) {
                    this.addWord(wordInput.value);
                    wordInput.value = '';
                }
            });
        }

        const styleSelect = document.getElementById('songStyleSelect');
        const styleCustom = document.getElementById('songStyleCustom');
        if (styleSelect && styleCustom) {
            const saved = this.settingsManager?.getSetting('songStyle');
            if (saved && STYLE_PRESETS.some((s) => s.value === saved)) styleSelect.value = saved;
            styleSelect.addEventListener('change', () => {
                const custom = styleSelect.value === '__custom';
                styleCustom.style.display = custom ? 'block' : 'none';
                if (custom) styleCustom.focus();
            });
        }

        const durationSelect = document.getElementById('songDurationSelect');
        if (durationSelect) {
            const saved = Number(this.settingsManager?.getSetting('songDurationSec'));
            if (saved && DURATION_OPTIONS.includes(saved)) durationSelect.value = String(saved);
            durationSelect.addEventListener('change', async () => {
                await this.settingsManager?.setSetting('songDurationSec', Number(durationSelect.value));
            });
        }

        document.getElementById('songGenerateBtn')?.addEventListener('click', () => this.onGenerate());
        document.getElementById('songCancelBtn')?.addEventListener('click', () => this.onCancel());
        document.getElementById('songStatusBtn')?.addEventListener('click', () => this.showServiceStatus());
        document.getElementById('songCopyBtn')?.addEventListener('click', () => this.copyLyrics());
        document.getElementById('songClearCacheBtn')?.addEventListener('click', () => this.clearCache());

        this.renderWordChips();
        this.refreshLibrary();
    }

    // -------------------------------------------------------------------------
    // 词管理
    // -------------------------------------------------------------------------

    addWord(raw) {
        const word = String(raw || '').trim().toLowerCase().replace(/[^a-z'-]/g, '');
        if (!word || word.length < 2) return;
        if (this.words.includes(word)) return;
        if (this.words.length >= 6) {
            NotificationManager.show('最多 6 个词，太多了歌会乱', 'warning');
            return;
        }
        this.words.push(word);
        this.renderWordChips();
    }

    removeWord(word) {
        this.words = this.words.filter((w) => w !== word);
        this.renderWordChips();
    }

    renderWordChips() {
        const box = document.getElementById('songWordChips');
        if (!box) return;
        if (!this.words.length) {
            box.innerHTML = '<span class="song-chip-empty">还没有选词</span>';
            return;
        }
        box.innerHTML = this.words
            .map(
                (w) =>
                    `<span class="song-chip">${escapeHtml(w)}<button data-word="${escapeAttr(
                        w
                    )}" title="移除">&times;</button></span>`
            )
            .join('');
        box.querySelectorAll('button[data-word]').forEach((btn) => {
            btn.addEventListener('click', () => this.removeWord(btn.dataset.word));
        });
    }

    /**
     * 由外部（发音面板）把练习句子同步进来，自动挑词
     * @param {string} sentence
     */
    syncFromSentence(sentence) {
        this.sentence = sentence || '';
        if (!sentence) return;
        const picked = SongStudio.pickWords(sentence, this.getSuggestedWords?.() || [], 4);
        if (picked.length) {
            this.words = picked;
            this.renderWordChips();
        }
    }

    // -------------------------------------------------------------------------
    // 生成
    // -------------------------------------------------------------------------

    async onGenerate() {
        if (this.busy) return;

        if (!this.words.length) {
            NotificationManager.show('先选几个要记的单词', 'warning');
            return;
        }

        const health = await this.studio.health(true);
        if (!health.ok) {
            NotificationManager.show(
                '连不上本地歌曲服务。请先运行 tools/song-bridge（npm start），或在设置里改端点。',
                'error',
                6000
            );
            this.showServiceStatus();
            return;
        }
        if (!health.comfyui?.up) {
            NotificationManager.show('ComfyUI 没起来（需要 http://127.0.0.1:8188）', 'error', 5000);
            return;
        }

        const styleSelect = document.getElementById('songStyleSelect');
        const custom = document.getElementById('songStyleCustom');
        const style =
            styleSelect?.value === '__custom'
                ? (custom?.value || '').trim() || 'acoustic folk pop'
                : styleSelect?.value || 'acoustic folk pop';

        const durationSec = Number(document.getElementById('songDurationSelect')?.value) || 60;

        await this.settingsManager?.setSetting('songStyle', style);
        await this.settingsManager?.setSetting('songDurationSec', durationSec);

        this.startBusy();
        this.streamedCaption = '';
        this.streamedLyrics = '';
        this.streamedNotes = '';
        this.showLyrics('');
        this.setCaption('');
        this.setNotes('');

        const lyricsBody = document.getElementById('songLyricsBody');
        const t0 = Date.now();

        const song = await this.studio.generate(
            { words: this.words, sentence: this.sentence, style, durationSec },
            {
                onStage: (d) => {
                    const label = STAGE_LABELS[d.stage] || d.stage;
                    this.setStatus(`${label}：${d.message}`);
                    if (d.stage === 'music') this.setProgress(0);
                },
                onCaption: (text) => {
                    this.streamedCaption += text;
                    this.setCaption(this.streamedCaption);
                },
                onLyrics: (text) => {
                    this.streamedLyrics += text;
                    if (lyricsBody) {
                        lyricsBody.textContent = this.streamedLyrics;
                        lyricsBody.scrollTop = lyricsBody.scrollHeight;
                    }
                },
                onNotes: (text) => {
                    this.streamedNotes += text;
                    this.setNotes(this.streamedNotes);
                },
                onProgress: (p) => {
                    if (p.max > 0) this.setProgress(p.value / p.max);
                },
                onDone: (result, cached) => {
                    this.currentSong = result;
                    this.showSong(result, cached);
                    this.setStatus(
                        cached
                            ? '命中缓存，直接播放'
                            : `完成，用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒`
                    );
                    this.setProgress(1);
                    this.refreshLibrary();
                    NotificationManager.show(cached ? '命中缓存 🎵' : '歌曲生成完成 🎵', 'success');
                },
                onError: (err) => {
                    this.setStatus(`失败：${err.message}`);
                    NotificationManager.show(`生成失败：${err.message}`, 'error', 6000);
                }
            }
        );

        this.endBusy();
        if (!song) this.setProgress(0);
    }

    onCancel() {
        this.studio.cancel();
        this.endBusy();
        this.setStatus('已取消');
    }

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
    }

    // -------------------------------------------------------------------------
    // 展示
    // -------------------------------------------------------------------------

    showSong(song, cached) {
        if (!song) return;
        const player = document.getElementById('songPlayer');
        const audio = document.getElementById('songAudioEl');
        const meta = document.getElementById('songPlayerMeta');
        if (!player || !audio) return;

        // 直接指向本地服务的音频地址，服务端支持 Range，浏览器边下边播
        audio.src = this.studio.audioUrl(song.id);
        audio.load();
        player.style.display = 'block';
        audio.play().catch(() => {
            /* 浏览器可能拦截自动播放，用户点一下即可 */
        });

        if (meta) {
            const kb = song.bytes ? `${(song.bytes / 1024 / 1024).toFixed(1)} MB` : '';
            meta.innerHTML = `
                <span class="song-meta-words">${escapeHtml((song.words || []).join(' · '))}</span>
                <span class="song-meta-tags">
                    <em>${escapeHtml(song.style || '')}</em>
                    ${song.durationSec ? `<em>${song.durationSec}s</em>` : ''}
                    ${kb ? `<em>${kb}</em>` : ''}
                    ${cached ? '<em class="song-tag-cache">缓存</em>' : ''}
                </span>`;
        }

        if (song.lyrics) this.showLyrics(song.lyrics);
        if (song.notes) this.setNotes(song.notes);
        if (song.caption) this.setCaption(song.caption);
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
        if (!clean) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        box.style.display = 'block';
        box.innerHTML = clean
            .split('\n')
            .filter(Boolean)
            .map((l) => `<div class="song-note-line">${escapeHtml(l)}</div>`)
            .join('');
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
        if (!songs.length) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = 'block';
        list.innerHTML = songs
            .slice(0, 12)
            .map(
                (s) => `
                <div class="song-library-item" data-id="${escapeAttr(s.id)}">
                    <button class="song-library-play" data-play="${escapeAttr(s.id)}" title="播放">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="song-library-info">
                        <div class="song-library-words">${escapeHtml((s.words || []).join(' · '))}</div>
                        <div class="song-library-sub">${escapeHtml(s.style || '')} · ${s.durationSec || '?'}s</div>
                    </div>
                    <button class="song-library-del" data-del="${escapeAttr(s.id)}" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`
            )
            .join('');

        list.querySelectorAll('[data-play]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const song = songs.find((x) => x.id === btn.dataset.play);
                if (song) {
                    this.currentSong = song;
                    this.showSong(song, true);
                    this.setStatus('播放缓存歌曲');
                }
            });
        });
        list.querySelectorAll('[data-del]').forEach((btn) => {
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
            span.innerHTML = `❌ 本地歌曲服务未连接（${escapeHtml(health.error || '未知')}）。启动方式：<code>cd tools/song-bridge &amp;&amp; npm start</code>`;
            return;
        }
        const ft = health.freetoken || {};
        const cf = health.comfyui || {};
        const lm = health.lmstudio || {};
        const gpu = health.gpu || {};
        span.innerHTML = `
            <div>FreeToken(Qwen3.8-27B)：${ft.up ? (ft.status === 'ok' ? '✅ 就绪' : `⏳ ${escapeHtml(ft.phase || ft.status || '加载中')}`) : '⭕ 未启动（点生成会自动拉起）'}</div>
            <div>ComfyUI(MiniMax Music 3)：${cf.up ? '✅ 在线' : '❌ 未连接'}</div>
            <div>LM Studio(翻译)：${(lm.loaded || []).length ? `✅ ${escapeHtml((lm.loaded || []).join(', '))}` : '⭕ 无模型常驻'}</div>
            <div>可用显存：${gpu.vramFreeGiB != null ? gpu.vramFreeGiB + ' GiB' : '未知'}${gpu.holder ? ` · 占用中：${escapeHtml(gpu.holder)}` : ''}</div>
            <div>缓存：${health.cache?.songs ?? 0} 首 · ${((health.cache?.bytes || 0) / 1024 / 1024).toFixed(1)} MB</div>
        `;
    }

    async copyLyrics() {
        const text = document.getElementById('songLyricsBody')?.textContent || '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            NotificationManager.show('歌词已复制');
        } catch (_) {
            NotificationManager.show('复制失败', 'error');
        }
    }
}

const STAGE_LABELS = {
    lyrics: '✍️ 写词',
    music: '🎼 作曲',
    save: '💾 保存'
};

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

export default SongStudioPanel;
