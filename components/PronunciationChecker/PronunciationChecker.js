/**
 * PronunciationChecker Component
 * 发音检查器组件 - Pronunciation Checker UI Component
 * 简化版：弹窗内仅承载歌曲面板（录音功能已移除），文本直接取主页输入框
 */

import { Component } from '../Component.js';
import { SongStudioPanel } from '../SongStudio/SongStudioPanel.js';

export class PronunciationCheckerComponent extends Component {
    constructor(containerId = '#pronunciationModal') {
        super(containerId);

        // 歌曲面板：直接用主文本，曲风随机、时长自动
        this.songPanel = new SongStudioPanel({
            getMainText: () => this.getMainText()
        });
    }

    getMainText() {
        const el = document.getElementById('textInput');
        return (el ? el.value : '').trim();
    }

    render() {
        const html = `
            <div class="modal-content pronunciation-checker-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-microphone"></i> Pronunciation Practice</h3>
                    <button class="modal-close" id="pronunciationModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="pronunciation-section">
                        <!-- Song studio：按主文本自动作曲（文本来源为首页输入框，无需额外预览/输入框） -->
                        ${this.songPanel.render()}
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    attachEventListeners() {
        const closeBtn = document.getElementById('pronunciationModalClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());

        this.songPanel.mount();
    }

    open() {
        if (!this.container.querySelector('.pronunciation-checker-modal') || !document.getElementById('songStudio')) {
            this.render();
        }
        this.container.classList.add('show');
        this.songPanel.syncFromMainText?.(this.getMainText());
        this.songPanel.refreshLibrary();
    }

    close() {
        this.container.classList.remove('show');
    }
}
