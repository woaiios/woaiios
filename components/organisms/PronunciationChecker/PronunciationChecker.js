/**
 * PronunciationChecker Component
 * 发音检查器组件 - Pronunciation Checker UI Component
 * 
 * 提供用户界面用于：
 * - 选择或输入练习句子
 * - 开始/停止录音
 * - 显示识别结果和评分
 * - 提供发音改进建议
 */

import { PronunciationChecker } from '../../../js/PronunciationChecker.js';
import { Component } from '../../Component.js';

export class PronunciationCheckerComponent extends Component {
    constructor(containerId = '#pronunciationModal') {
        super(containerId);
        this.pronunciationChecker = new PronunciationChecker();
        this.currentSentence = '';
        this.practiceHistory = [];
        this.maxHistorySize = 10;
        
        // 示例句子库 (Sample sentences library)
        this.sampleSentences = [
            "Hello, how are you today?",
            "I love learning English every day.",
            "Practice makes perfect.",
            "The quick brown fox jumps over the lazy dog.",
            "Reading books helps improve vocabulary.",
            "Pronunciation is important for clear communication.",
            "I enjoy studying new words and phrases.",
            "Speaking English fluently takes time and effort.",
            "Consistency is key to language learning success.",
            "Every mistake is an opportunity to learn."
        ];
        
        this.setupEventHandlers();
    }

    /**
     * 设置事件处理器 - Setup event handlers
     */
    setupEventHandlers() {
        // 语音识别回调 (Speech recognition callbacks)
        this.pronunciationChecker.on('start', () => {
            this.updateRecordingUI(true);
        });

        this.pronunciationChecker.on('result', (result) => {
            this.displayResult(result);
            this.addToHistory(result);
        });

        this.pronunciationChecker.on('end', () => {
            this.updateRecordingUI(false);
        });

        this.pronunciationChecker.on('error', (error) => {
            this.showError(error);
            this.updateRecordingUI(false);
        });
    }

    /**
     * 渲染组件 - Render component
     */
    render() {
        const isSupported = PronunciationChecker.isSupported();
        
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
                        <h4>Select or Enter a Sentence</h4>
                        
                        <!-- Sample sentences -->
                        <div class="sample-sentences">
                            <select id="sampleSentenceSelect" class="form-control">
                                <option value="">-- Choose a sample sentence --</option>
                                ${this.sampleSentences.map((sentence, index) => 
                                    `<option value="${index}">${sentence}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <!-- Custom sentence input -->
                        <div class="custom-sentence">
                            <textarea 
                                id="customSentenceInput" 
                                class="form-control" 
                                placeholder="Or type your own sentence here..."
                                rows="3"
                            ></textarea>
                        </div>
                        
                        <!-- Current practice sentence -->
                        <div class="practice-sentence" id="practiceSentence" style="display: none;">
                            <h4>Practice Sentence:</h4>
                            <div class="sentence-display" id="sentenceDisplay"></div>
                        </div>
                        
                        <!-- Recording controls -->
                        <div class="recording-controls" id="recordingControls" style="display: none;">
                            <button 
                                id="startRecordingBtn" 
                                class="btn btn-primary btn-large"
                                ${!isSupported ? 'disabled' : ''}
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
                                    <i class="fas fa-random"></i> New Sentence
                                </button>
                            </div>
                        </div>
                        
                        <!-- Practice History -->
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
    }

    /**
     * 附加事件监听器 - Attach event listeners
     */
    attachEventListeners() {
        // Close button
        const closeBtn = document.getElementById('pronunciationModalClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Sample sentence selection
        const sampleSelect = document.getElementById('sampleSentenceSelect');
        if (sampleSelect) {
            sampleSelect.addEventListener('change', (e) => {
                const index = e.target.value;
                if (index !== '') {
                    const sentence = this.sampleSentences[parseInt(index)];
                    this.setSentence(sentence);
                    document.getElementById('customSentenceInput').value = '';
                }
            });
        }

        // Custom sentence input
        const customInput = document.getElementById('customSentenceInput');
        if (customInput) {
            customInput.addEventListener('input', (e) => {
                const sentence = e.target.value.trim();
                if (sentence.length > 0) {
                    this.setSentence(sentence);
                    document.getElementById('sampleSentenceSelect').value = '';
                }
            });
        }

        // Recording controls
        const startBtn = document.getElementById('startRecordingBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startRecording());
        }

        const stopBtn = document.getElementById('stopRecordingBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopRecording());
        }

        // Result actions
        const tryAgainBtn = document.getElementById('tryAgainBtn');
        if (tryAgainBtn) {
            tryAgainBtn.addEventListener('click', () => this.tryAgain());
        }

        const newSentenceBtn = document.getElementById('newSentenceBtn');
        if (newSentenceBtn) {
            newSentenceBtn.addEventListener('click', () => this.selectNewSentence());
        }
    }

    /**
     * 设置练习句子 - Set practice sentence
     * @param {string} sentence - 句子 (Sentence)
     */
    setSentence(sentence) {
        this.currentSentence = sentence.trim();
        
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        const practiceSentence = document.getElementById('practiceSentence');
        const recordingControls = document.getElementById('recordingControls');
        const resultDiv = document.getElementById('pronunciationResult');
        
        if (sentenceDisplay) {
            sentenceDisplay.textContent = this.currentSentence;
        }
        
        if (practiceSentence) {
            practiceSentence.style.display = 'block';
        }
        
        if (recordingControls) {
            recordingControls.style.display = 'flex';
        }
        
        if (resultDiv) {
            resultDiv.style.display = 'none';
        }
    }

    /**
     * 开始录音 - Start recording
     */
    startRecording() {
        if (!this.currentSentence) {
            alert('Please select or enter a sentence first.');
            return;
        }

        try {
            this.pronunciationChecker.startRecording(this.currentSentence);
        } catch (error) {
            this.showError(error.message);
        }
    }

    /**
     * 停止录音 - Stop recording
     */
    stopRecording() {
        this.pronunciationChecker.stopRecording();
    }

    /**
     * 更新录音界面状态 - Update recording UI state
     * @param {boolean} isRecording - 是否正在录音 (Is recording)
     */
    updateRecordingUI(isRecording) {
        const startBtn = document.getElementById('startRecordingBtn');
        const stopBtn = document.getElementById('stopRecordingBtn');
        const recordingStatus = document.getElementById('recordingStatus');

        if (startBtn) {
            startBtn.style.display = isRecording ? 'none' : 'inline-block';
        }
        
        if (stopBtn) {
            stopBtn.style.display = isRecording ? 'inline-block' : 'none';
        }
        
        if (recordingStatus) {
            recordingStatus.style.display = isRecording ? 'block' : 'none';
        }
    }

    /**
     * 显示结果 - Display result
     * @param {Object} result - 识别结果 (Recognition result)
     */
    displayResult(result) {
        const resultDiv = document.getElementById('pronunciationResult');
        const scoreValue = document.getElementById('scoreValue');
        const recognizedText = document.getElementById('recognizedText');
        const targetText = document.getElementById('targetText');
        const feedbackMessage = document.getElementById('feedbackMessage');
        const suggestionsList = document.getElementById('suggestionsList');

        if (resultDiv) {
            resultDiv.style.display = 'block';
        }

        if (scoreValue) {
            scoreValue.textContent = result.score;
            scoreValue.className = `score-value score-${result.feedback.level}`;
        }

        if (recognizedText) {
            recognizedText.textContent = result.recognized;
        }

        if (targetText) {
            targetText.textContent = result.target;
        }

        if (feedbackMessage) {
            feedbackMessage.textContent = result.feedback.message;
        }

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

    /**
     * 添加到历史记录 - Add to history
     * @param {Object} result - 识别结果 (Recognition result)
     */
    addToHistory(result) {
        const historyItem = {
            timestamp: new Date().toLocaleString(),
            sentence: result.target,
            recognized: result.recognized,
            score: result.score,
            level: result.feedback.level
        };

        this.practiceHistory.unshift(historyItem);
        
        // 限制历史记录大小 (Limit history size)
        if (this.practiceHistory.length > this.maxHistorySize) {
            this.practiceHistory.pop();
        }

        this.updateHistoryDisplay();
    }

    /**
     * 更新历史记录显示 - Update history display
     */
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

        this.practiceHistory.forEach((item, index) => {
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

    /**
     * 重试 - Try again
     */
    tryAgain() {
        const resultDiv = document.getElementById('pronunciationResult');
        if (resultDiv) {
            resultDiv.style.display = 'none';
        }
    }

    /**
     * 选择新句子 - Select new sentence
     */
    selectNewSentence() {
        document.getElementById('sampleSentenceSelect').value = '';
        document.getElementById('customSentenceInput').value = '';
        document.getElementById('practiceSentence').style.display = 'none';
        document.getElementById('recordingControls').style.display = 'none';
        document.getElementById('pronunciationResult').style.display = 'none';
        this.currentSentence = '';
    }

    /**
     * 显示错误 - Show error
     * @param {string} error - 错误信息 (Error message)
     */
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

    /**
     * 打开组件 - Open component
     */
    open() {
        if (!this.container.querySelector('.pronunciation-checker-modal')) {
            this.render();
        }
        this.container.classList.add('show');
    }

    /**
     * 关闭组件 - Close component
     */
    close() {
        this.container.classList.remove('show');
        
        // 停止任何正在进行的录音 (Stop any ongoing recording)
        if (this.pronunciationChecker.isRecording) {
            this.pronunciationChecker.stopRecording();
        }
    }
}
