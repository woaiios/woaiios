/**
 * PronunciationChecker Component
 * 发音检查器组件 - Pronunciation Checker UI Component
 * 简化版：文本直接取主页输入框，不再选句；歌曲面板按主文本自动随机曲风/时长
 */

import { PronunciationChecker } from '../../js/PronunciationChecker.js';
import { Component } from '../Component.js';
import { SongStudioPanel } from '../SongStudio/SongStudioPanel.js';

export class PronunciationCheckerComponent extends Component {
    constructor(containerId = '#pronunciationModal', settingsManager = null) {
        super(containerId);
        this.pronunciationChecker = new PronunciationChecker();
        this.currentSentence = '';
        this.practiceHistory = [];
        this.maxHistorySize = 10;

        // 歌曲面板：直接用主文本，曲风随机、时长自动
        this.songPanel = new SongStudioPanel({
            settingsManager,
            getMainText: () => this.getMainText()
        });
        
        this.setupEventHandlers();
    }

    getMainText() {
        const el = document.getElementById('textInput');
        return (el ? el.value : '').trim();
    }

    setupEventHandlers() {
        this.pronunciationChecker.on('start', () => this.updateRecordingUI(true));
        this.pronunciationChecker.on('result', (result) => {
            this.displayResult(result);
            this.addToHistory(result);
        });
        this.pronunciationChecker.on('end', () => this.updateRecordingUI(false));
        this.pronunciationChecker.on('error', (error) => {
            this.showError(error);
            this.updateRecordingUI(false);
        });
    }

    render() {
        const isSupported = PronunciationChecker.isSupported();
        const mainText = this.getMainText();
        const preview = mainText ? escapeHtml(mainText.slice(0, 800)) + (mainText.length > 800 ? '…' : '') : '<span class="muted">（主页输入框为空，请先粘贴文本）</span>';
        const html = `
            <div class="modal-content pronunciation-checker-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-microphone"></i> Pronunciation Practice</h3>
                    <button class="modal-close" id="pronunciationModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    ${!isSupported ? `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>Browser Not Supported</strong>
                            <p>Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.</p>
                        </div>
                    ` : ''}
                    
                    <div class="pronunciation-section">
                        <div class="main-text-preview" id="pronunciationMainTextPreview">
                            <h4>当前文本（来自主页）</h4>
                            <div class="sentence-display" id="sentenceDisplay">${preview}</div>
                            <p class="hint muted" style="font-size:12px;margin-top:6px;">在主页修改文本后，重新打开此窗口即可更新。长文本会自动按发音段落评分。</p>
                        </div>

                        <!-- Song studio：按主文本自动作曲 -->
                        ${this.songPanel.render()}
                        
                        <!-- Recording controls -->
                        <div class="recording-controls" id="recordingControls">
                            <button 
                                id="startRecordingBtn" 
                                class="btn btn-primary btn-large"
                                ${!isSupported || !mainText ? 'disabled' : ''}
                            >
                                <i class="fas fa-microphone"></i>
                                <span class="btn-text">Start Recording</span>
                            </button>
                            <button 
                                id="stopRecordingBtn" 
                                class="btn btn-danger btn-large" 
                                style="display: none;"
                            >
                                <i class="fas fa-stop"></i>
                                <span class="btn-text">Stop Recording</span>
                            </button>
                        </div>
                        
                        <div class="recording-status" id="recordingStatus" style="display: none;">
                            <div class="recording-indicator">
                                <i class="fas fa-circle recording-dot"></i>
                                <span>Recording... Speak now!</span>
                            </div>
                        </div>
                        
                        <!-- Results -->
                        <div class="pronunciation-result" id="pronunciationResult" style="display: none;">
                            <h4>Result</h4>
                            <div class="result-score" id="resultScore">
                                <div class="score-circle">
                                    <div class="score-value" id="scoreValue">0</div>
                                    <div class="score-label">Score</div>
                                </div>
                            </div>
                            <div class="result-details">
                                <div class="result-item">
                                    <strong>You said:</strong>
                                    <p id="recognizedText" class="recognized-text"></p>
                                </div>
                                <div class="result-item">
                                    <strong>Target:</strong>
                                    <p id="targetText" class="target-text"></p>
                                </div>
                                <div class="feedback-section" id="feedbackSection">
                                    <strong>Feedback:</strong>
                                    <p id="feedbackMessage" class="feedback-message"></p>
                                    <ul id="suggestionsList" class="suggestions-list"></ul>
                                </div>
                            </div>
                            <div class="result-actions">
                                <button id="tryAgainBtn" class="btn btn-secondary">
                                    <i class="fas fa-redo"></i> Try Again
                                </button>
                                <button id="newSentenceBtn" class="btn btn-outline">
                                    <i class="fas fa-random"></i> Reset
                                </button>
                            </div>
                        </div>
                        
                        <div class="practice-history" id="practiceHistory" style="display: none;">
                            <h4>Practice History</h4>
                            <div id="historyList" class="history-list"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
        // 同步当前句为满主文本
        this.currentSentence = mainText;
    }

    attachEventListeners() {
        const closeBtn = document.getElementById('pronunciationModalClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());

        this.songPanel.mount();

        const startBtn = document.getElementById('startRecordingBtn');
        if (startBtn) startBtn.addEventListener('click', () => this.startRecording());
        const stopBtn = document.getElementById('stopRecordingBtn');
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopRecording());
        const tryAgainBtn = document.getElementById('tryAgainBtn');
        if (tryAgainBtn) tryAgainBtn.addEventListener('click', () => this.tryAgain());
        const newSentenceBtn = document.getElementById('newSentenceBtn');
        if (newSentenceBtn) newSentenceBtn.addEventListener('click', () => this.selectNewSentence());
    }

    setSentence(sentence) {
        // 兼容旧调用，实际以主文本为准
        this.currentSentence = (sentence || this.getMainText()).trim();
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        if (sentenceDisplay) {
            const t = this.currentSentence;
            sentenceDisplay.innerHTML = t ? escapeHtml(t.slice(0, 800)) + (t.length > 800 ? '…' : '') : '<span class="muted">（主页输入框为空）</span>';
        }
        const recordingControls = document.getElementById('recordingControls');
        if (recordingControls) recordingControls.style.display = 'flex';
        const resultDiv = document.getElementById('pronunciationResult');
        if (resultDiv) resultDiv.style.display = 'none';
        const startBtn = document.getElementById('startRecordingBtn');
        if (startBtn) startBtn.disabled = !this.currentSentence;
    }

    startRecording() {
        const main = this.getMainText();
        if (!main) {
            alert('请先在主页输入框粘贴要练习的文本。');
            return;
        }
        this.currentSentence = main;
        try {
            // 长文本截断到 500 字符避免 Web Speech 超限，评分仍以全段为准
            const target = main.length > 500 ? main.slice(0, 500) : main;
            this.pronunciationChecker.startRecording(target);
            const td = document.getElementById('targetText');
            if (td) td.textContent = target;
        } catch (error) {
            this.showError(error.message);
        }
    }

    stopRecording() {
        this.pronunciationChecker.stopRecording();
    }

    updateRecordingUI(isRecording) {
        const startBtn = document.getElementById('startRecordingBtn');
        const stopBtn = document.getElementById('stopRecordingBtn');
        const recordingStatus = document.getElementById('recordingStatus');
        if (startBtn) startBtn.style.display = isRecording ? 'none' : 'inline-block';
        if (stopBtn) stopBtn.style.display = isRecording ? 'inline-block' : 'none';
        if (recordingStatus) recordingStatus.style.display = isRecording ? 'block' : 'none';
    }

    displayResult(result) {
        const resultDiv = document.getElementById('pronunciationResult');
        const scoreValue = document.getElementById('scoreValue');
        const recognizedText = document.getElementById('recognizedText');
        const targetText = document.getElementById('targetText');
        const feedbackMessage = document.getElementById('feedbackMessage');
        const suggestionsList = document.getElementById('suggestionsList');
        if (resultDiv) resultDiv.style.display = 'block';
        if (scoreValue) {
            scoreValue.textContent = result.score;
            scoreValue.className = `score-value score-${result.feedback.level}`;
        }
        if (recognizedText) recognizedText.textContent = result.recognized;
        if (targetText) targetText.textContent = result.target;
        if (feedbackMessage) feedbackMessage.textContent = result.feedback.message;
        if (suggestionsList) {
            suggestionsList.innerHTML = '';
            if (result.feedback.suggestions.length > 0) {
                result.feedback.suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    li.textContent = suggestion;
                    suggestionsList.appendChild(li);
                });
            }
        }
    }

    addToHistory(result) {
        const historyItem = {
            timestamp: new Date().toLocaleString(),
            sentence: result.target,
            recognized: result.recognized,
            score: result.score,
            level: result.feedback.level
        };
        this.practiceHistory.unshift(historyItem);
        if (this.practiceHistory.length > this.maxHistorySize) this.practiceHistory.pop();
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyDiv = document.getElementById('practiceHistory');
        const historyList = document.getElementById('historyList');
        if (!historyDiv || !historyList) return;
        if (this.practiceHistory.length === 0) {
            historyDiv.style.display = 'none';
            return;
        }
        historyDiv.style.display = 'block';
        historyList.innerHTML = '';
        this.practiceHistory.forEach((item) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-header">
                    <span class="history-time">${item.timestamp}</span>
                    <span class="history-score score-${item.level}">${item.score}</span>
                </div>
                <div class="history-sentence">${item.sentence}</div>
            `;
            historyList.appendChild(historyItem);
        });
    }

    tryAgain() {
        const resultDiv = document.getElementById('pronunciationResult');
        if (resultDiv) resultDiv.style.display = 'none';
    }

    selectNewSentence() {
        const r = document.getElementById('pronunciationResult');
        if (r) r.style.display = 'none';
        // 重新与主文本同步
        this.setSentence(this.getMainText());
    }

    showError(error) {
        let message = 'An error occurred. Please try again.';
        if (error === 'not-allowed' || error === 'permission-denied') {
            message = 'Microphone permission denied. Please allow microphone access in your browser settings.';
        } else if (error === 'no-speech') {
            message = 'No speech detected. Please try speaking again.';
        } else if (error === 'network') {
            message = 'Network error. Please check your internet connection.';
        }
        alert(message);
    }

    collectHighlightedWords() {
        const container = document.getElementById('highlightedWordsContainer');
        if (!container) return [];
        return Array.from(container.querySelectorAll('.highlighted-word-item .word'))
            .map((el) => (el.textContent || '').trim().split(/[\s/]/)[0].toLowerCase())
            .filter((w) => /^[a-z]+$/.test(w))
            .slice(0, 6);
    }

    open() {
        if (!this.container.querySelector('.pronunciation-checker-modal')) {
            this.render();
        } else if (!document.getElementById('songStudio')) {
            this.render();
        } else {
            // 已渲染则刷新预览与按钮状态
            this.setSentence(this.getMainText());
        }
        this.container.classList.add('show');
        // 同步歌曲面板的主文本
        this.songPanel.syncFromMainText?.(this.getMainText());
        this.songPanel.refreshLibrary();
    }

    close() {
        this.container.classList.remove('show');
        if (this.pronunciationChecker.isRecording) {
            this.pronunciationChecker.stopRecording();
        }
    }
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
