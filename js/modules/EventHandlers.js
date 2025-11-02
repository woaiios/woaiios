/**
 * EventHandlers - 事件处理器
 * 负责设置所有 UI 交互的事件监听
 * (Handles all UI interaction event listeners)
 */
import { UIRenderer } from './UIRenderer.js';

export class EventHandlers {
    /**
     * 构造函数
     * @param {Object} app - WordDiscoverer 应用实例
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * 添加所有事件监听器 - Add all event listeners
     */
    addAll() {
        this._addMainButtonEvents();
        this._addWordModalEvents();
        this._addSettingsEvents();
    }

    /**
     * 添加主要按钮事件 - Add main button events
     * @private
     */
    _addMainButtonEvents() {
        document.getElementById('analyzeBtn').addEventListener('click', () => this.app.analyzeText());
        document.getElementById('vocabularyBtn').addEventListener('click', () => this.app.vocabularyComponent.open());
        document.getElementById('settingsBtn').addEventListener('click', () => this.app.settingsComponent.open());
        document.getElementById('pronunciationBtn').addEventListener('click', () => this.app.pronunciationCheckerComponent.open());
        document.getElementById('clearBtn').addEventListener('click', () => UIRenderer.clearText());
    }

    /**
     * 添加单词模态框事件 - Add word modal events
     * @private
     */
    _addWordModalEvents() {
        const wordModalClose = document.getElementById('wordModalClose');
        if (wordModalClose) {
            wordModalClose.addEventListener('click', () => {
                document.getElementById('wordModal').classList.remove('show');
            });
        }
    }

    /**
     * 添加设置相关事件 - Add settings-related events
     * 同步主页面和设置页面的配置选项
     * @private
     */
    _addSettingsEvents() {
        // 同步难度级别选择
        const mainDifficultyLevel = document.getElementById('mainDifficultyLevel');
        if (mainDifficultyLevel) {
            mainDifficultyLevel.addEventListener('change', async (e) => {
                this.app.settingsManager.setSetting('difficultyLevel', e.target.value);
                await this.app.refreshTextAnalysis(); // 立即刷新文本分析结果
            });
        }
        
        // 同步高亮模式选择
        const mainHighlightMode = document.getElementById('mainHighlightMode');
        if (mainHighlightMode) {
            mainHighlightMode.addEventListener('change', async (e) => {
                this.app.settingsManager.setSetting('highlightMode', e.target.value);
                await this.app.refreshTextAnalysis(); // 立即刷新文本分析结果
            });
        }
    }
}
