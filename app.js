/**
 * Word Discoverer Application
 * 单词发现应用 - 主入口文件
 * 
 * 应用架构 (Application Architecture):
 * - 采用模块化设计，分离核心逻辑和 UI 组件 (Modular design separating core logic and UI components)
 * - 使用 ECDICT 76万+ 词条数据库 (Using ECDICT database with 760,000+ entries)
 * - 渐进式加载数据库，优化首次加载速度 (Progressive database loading for faster initial load)
 * - 支持 Google Drive 云端同步 (Google Drive cloud synchronization support)
 * 
 * 核心模块 (Core Modules):
 * - WordDatabase: 词典数据库管理 (Dictionary database management)
 * - TextAnalyzer: 文本分析引擎 (Text analysis engine)
 * - VocabularyManager: 词汇管理 (Vocabulary management)
 * - SettingsManager: 设置管理 (Settings management)
 * 
 * UI 组件 (UI Components):
 * - VocabularyComponent: 词汇列表界面 (Vocabulary list interface)
 * - SettingsComponent: 设置界面 (Settings interface)
 * - AnalyzedTextComponent: 文本分析结果显示 (Analyzed text display)
 */
import { WordDatabase } from './js/WordDatabase.js';
import { TextAnalyzer } from './js/TextAnalyzer.js';
import { VocabularyManager } from './js/VocabularyManager.js';
import { SettingsManager } from './js/SettingsManager.js';
import { VocabularyComponent } from './components/Vocabulary/Vocabulary.js';
import { SettingsComponent } from './components/Settings/Settings.js';
import { AnalyzedTextComponent } from './components/AnalyzedText/AnalyzedText.js';

/**
 * WordDiscoverer 主类 - Main WordDiscoverer Class
 * 应用的核心控制器，协调各个模块和组件 (Core controller coordinating all modules and components)
 */
class WordDiscoverer {
    /**
     * 构造函数 - Constructor
     * 初始化所有核心模块和 UI 组件 (Initialize all core modules and UI components)
     */
    constructor() {
        // 核心逻辑模块 (Core Logic Modules)
        this.settingsManager = new SettingsManager();               // 设置管理器 (Settings manager)
        this.wordDatabase = new WordDatabase();                     // 词典数据库 (Dictionary database)
        this.vocabularyManager = new VocabularyManager();           // 词汇管理器 (Vocabulary manager)
        this.textAnalyzer = new TextAnalyzer(this.wordDatabase);   // 文本分析器 (Text analyzer)

        // UI 组件 (UI Components)
        this.vocabularyComponent = new VocabularyComponent(this.vocabularyManager);
        this.settingsComponent = new SettingsComponent(this.settingsManager, this.vocabularyManager.googleDriveManager);
        this.analyzedTextComponent = new AnalyzedTextComponent('#analyzedText', this.vocabularyManager);
        
        // 设置组件与主应用的双向引用 (Set bidirectional references between components and main app)
        this.vocabularyComponent.setApp(this);
        this.settingsComponent.setApp(this);
        this.analyzedTextComponent.setApp(this);

        this.initialize();
    }

    /**
     * 初始化应用 - Initialize application
     * 设置事件监听器，加载数据库，显示加载进度 (Set up event listeners, load database, show loading progress)
     * @returns {Promise<void>}
     */
    async initialize() {
        this.addEventListeners();
        this.updateCounts();
        
        // 显示数据库加载遮罩层 (Show database loading overlay)
        const dbLoadingOverlay = document.getElementById('dbLoadingOverlay');
        const dbProgressBar = document.getElementById('dbProgressBar');
        const dbProgressPercentage = document.getElementById('dbProgressPercentage');
        const dbProgressChunks = document.getElementById('dbProgressChunks');
        const dbLoadingMessage = document.getElementById('dbLoadingMessage');
        
        dbLoadingOverlay.classList.add('show');
        
        // 设置进度回调 - 更新加载进度条 (Set progress callback - update loading progress bar)
        this.wordDatabase.setProgressCallback((data) => {
            dbProgressBar.style.width = `${data.percentage.toFixed(1)}%`;
            dbProgressPercentage.textContent = `${data.percentage.toFixed(1)}%`;
            
            // 在消息中显示缓存状态 (Show cache status in message)
            let message = data.message || 'Loading...';
            if (data.fromCache === true) {
                message = `📦 ${message}`;
                dbLoadingMessage.style.color = '#059669'; // 缓存数据显示绿色 (Green for cached)
            } else if (data.fromCache === false) {
                message = `⬇️ ${message}`;
                dbLoadingMessage.style.color = '#3b82f6'; // 下载数据显示蓝色 (Blue for downloading)
            }
            dbLoadingMessage.textContent = message;
        });
        
        // 设置分块加载完成回调 (Set chunk loaded callback)
        if (this.wordDatabase.progressiveLoader) {
            this.wordDatabase.progressiveLoader.on('chunkLoaded', (data) => {
                const cacheStatus = data.fromCache ? ' (cached)' : '';
                dbProgressChunks.textContent = `${data.loaded}/${data.total} chunks${cacheStatus}`;
            });
            
            // 所有分块加载完成后隐藏遮罩 (Hide overlay after all chunks are loaded)
            this.wordDatabase.progressiveLoader.on('complete', () => {
                setTimeout(() => {
                    dbLoadingOverlay.classList.remove('show');
                }, 1000);
            });
        }
        
        // 初始化数据库 (Initialize database)
        await this.wordDatabase.initialize();
        
        // 首批数据加载完成后隐藏遮罩（应用已可用）(Hide overlay after first chunks - app is usable)
        setTimeout(() => {
            dbLoadingOverlay.classList.remove('show');
        }, 500);
        
        console.log('WordDiscoverer initialized successfully');
    }

    /**
     * 添加事件监听器 - Add event listeners
     * 设置所有 UI 交互的事件处理 (Set up event handlers for all UI interactions)
     */
    addEventListeners() {
        // 主要按钮事件 (Main button events)
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeText());
        document.getElementById('vocabularyBtn').addEventListener('click', () => this.vocabularyComponent.open());
        document.getElementById('settingsBtn').addEventListener('click', () => this.settingsComponent.open());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearText());
        
        // 单词模态框关闭按钮 (Word modal close button)
        const wordModalClose = document.getElementById('wordModalClose');
        if (wordModalClose) {
            wordModalClose.addEventListener('click', () => {
                document.getElementById('wordModal').classList.remove('show');
            });
        }
        
        // 同步主页面和设置页面的难度级别选择 (Synchronize difficulty level between main page and settings)
        const mainDifficultyLevel = document.getElementById('mainDifficultyLevel');
        if (mainDifficultyLevel) {
            mainDifficultyLevel.addEventListener('change', async (e) => {
                this.settingsManager.setSetting('difficultyLevel', e.target.value);
                await this.refreshTextAnalysis(); // 立即刷新文本分析结果 (Immediately refresh analysis)
            });
        }
        
        // 同步主页面和设置页面的高亮模式选择 (Synchronize highlight mode between main page and settings)
        const mainHighlightMode = document.getElementById('mainHighlightMode');
        if (mainHighlightMode) {
            mainHighlightMode.addEventListener('change', async (e) => {
                this.settingsManager.setSetting('highlightMode', e.target.value);
                await this.refreshTextAnalysis(); // 立即刷新文本分析结果 (Immediately refresh analysis)
            });
        }
    }

    /**
     * 分析文本 - Analyze text
     * 主要的文本分析流程：提取单词 -> 分析难度 -> 生成高亮显示 -> 更新统计信息
     * (Main text analysis flow: extract words -> analyze difficulty -> generate highlights -> update statistics)
     * @returns {Promise<void>}
     */
    async analyzeText() {
        const text = document.getElementById('textInput').value.trim();
        if (!text) {
            this.showNotification('Please enter some text to analyze.', 'error');
            return;
        }

        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.classList.add('show');

        try {
            // 执行文本分析 (Perform text analysis)
            const analysis = await this.performTextAnalysis(text);
            // 生成带高亮的文本 (Generate text with highlights)
            const processedText = await this.textAnalyzer.processTextForDisplay(text, analysis);
            // 渲染分析结果 (Render analysis results)
            this.analyzedTextComponent.render(processedText);
            
            // 显示结果区域 (Show result sections)
            document.getElementById('analyzedTextSection').style.display = 'block';
            document.getElementById('statistics').style.display = 'flex';
            document.getElementById('highlightedWordsList').style.display = 'block';
            
            // 更新统计信息和高亮词列表 (Update statistics and highlighted words list)
            this.updateStatistics(analysis);
            this.displayHighlightedWords(analysis.highlightedWords);

        } catch (error) {
            console.error('Analysis error:', error);
            this.showNotification('Error analyzing text. Please try again.', 'error');
        } finally {
            loadingOverlay.classList.remove('show');
        }
    }
    
    /**
     * 执行文本分析（集中方法）- Perform text analysis (centralized method)
     * 供多个地方调用的统一分析方法 (Unified analysis method called from multiple places)
     * @param {string} text - 要分析的文本 (Text to analyze)
     * @returns {Promise<Object>} 分析结果对象 (Analysis result object)
     */
    async performTextAnalysis(text) {
        const words = this.textAnalyzer.extractWords(text);
        return await this.textAnalyzer.analyzeWords(
            words,
            this.settingsManager.getSetting('difficultyLevel'),
            this.settingsManager.getSetting('highlightMode'),
            { learning: this.vocabularyManager.learningWords, mastered: this.vocabularyManager.masteredWords }
        );
    }
    
    /**
     * 刷新文本分析 - Refresh text analysis
     * 当设置改变时重新分析已有文本 (Re-analyze existing text when settings change)
     */
    async refreshTextAnalysis() {
        // 只有在已经有分析过的文本时才刷新 (Only refresh if text has been analyzed)
        if (document.getElementById('analyzedTextSection').style.display !== 'block') return;
        
        const text = document.getElementById('textInput').value.trim();
        if (!text) return;

        // 重新分析并更新显示 (Re-analyze and update display)
        const analysis = await this.performTextAnalysis(text);
        const processedText = await this.textAnalyzer.processTextForDisplay(text, analysis);
        this.analyzedTextComponent.render(processedText);
        this.updateStatistics(analysis);
        this.displayHighlightedWords(analysis.highlightedWords);
    }
    
    /**
     * 更新统计信息 - Update statistics
     * 更新页面上的词汇统计数字 (Update vocabulary statistics on the page)
     * @param {Object} analysis - 分析结果对象 (Analysis result object)
     */
    updateStatistics(analysis) {
        document.getElementById('totalWords').textContent = analysis.totalWords;
        document.getElementById('highlightedWords').textContent = analysis.highlightedWords.length;
        document.getElementById('newWords').textContent = analysis.newWords.length;
        document.getElementById('difficultyScore').textContent = analysis.difficultyScore;
    }

    /**
     * 显示高亮词汇列表 - Display highlighted words list
     * 在侧边栏显示所有被高亮的单词及其释义 (Show all highlighted words with translations in sidebar)
     * @param {Array} highlightedWords - 高亮词汇数组 (Array of highlighted words)
     */
    displayHighlightedWords(highlightedWords) {
        const container = document.getElementById('highlightedWordsContainer');
        container.innerHTML = '';

        if (highlightedWords.length === 0) {
            container.innerHTML = '<p>No highlighted words found.</p>';
            return;
        }

        const NO_TRANSLATION_TEXT = '无翻译'; // 本地化常量 (Localization constant)

        highlightedWords.forEach(wordInfo => {
            const wordItem = document.createElement('div');
            wordItem.className = 'highlighted-word-item';
            
            // 解析 HTML 翻译以提取发音和释义 (Parse HTML translation to extract pronunciation and meaning)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = wordInfo.translation;
            
            // 从紧凑格式中提取发音和翻译 (Extract pronunciation and translation from compact format)
            let pronunciation = '';
            let translation = '';
            
            const phoneticElement = tempDiv.querySelector('.phonetic-line');
            if (phoneticElement) {
                pronunciation = phoneticElement.textContent.trim();
            }
            
            const translationElement = tempDiv.querySelector('.translation-compact p');
            if (translationElement) {
                translation = translationElement.textContent.trim();
            }
            
            // 向后兼容旧格式 (Fallback to old format for backward compatibility)
            if (!pronunciation && !translation) {
                const pronElement = tempDiv.querySelector('.pron');
                if (pronElement) {
                    pronunciation = pronElement.textContent.trim();
                }
                
                const transElement = tempDiv.querySelector('.trans');
                if (transElement) {
                    translation = transElement.textContent.trim();
                }
            }
            
            // 如果仍然无法解析，尝试从任何 <p> 标签提取 (If still can't parse, try to extract from any <p> tag)
            if (!translation) {
                const firstP = tempDiv.querySelector('p');
                if (firstP) {
                    translation = firstP.textContent.trim();
                }
            }
            
            // 使用 DOM 操作而非 innerHTML 以提高安全性 (Use DOM manipulation instead of innerHTML for security)
            // 单词和音标显示在同一行 (Word and phonetic on the same line)
            const wordDiv = document.createElement('div');
            wordDiv.className = 'word';
            wordDiv.textContent = pronunciation ? `${wordInfo.word} ${pronunciation}` : wordInfo.word;
            wordItem.appendChild(wordDiv);
            
            const transDiv = document.createElement('div');
            transDiv.className = 'translation';
            transDiv.textContent = translation || NO_TRANSLATION_TEXT;
            wordItem.appendChild(transDiv);
            
            container.appendChild(wordItem);
        });
    }

    /**
     * 更新词汇数量显示 - Update vocabulary counts
     * 刷新词汇组件中的学习和已掌握单词数量 (Refresh learning and mastered word counts in vocabulary component)
     */
    updateCounts() {
        this.vocabularyComponent.updateCounts();
    }

    /**
     * 显示通知消息 - Show notification message
     * 在屏幕右上角显示临时通知 (Display temporary notification in top-right corner)
     * @param {string} message - 消息文本 (Message text)
     * @param {string} type - 消息类型：'success', 'error', 'info' (Message type: 'success', 'error', 'info')
     */
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: ${colors[type] || colors.success}; color: white;
            padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 3000; animation: slideIn 0.3s ease; max-width: 300px; word-wrap: break-word;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        // 3秒后自动移除 (Auto-remove after 3 seconds)
        setTimeout(() => notification.remove(), 3000);
    }

    /**
     * 下载 JSON 数据 - Download JSON data
     * 将数据转换为 JSON 文件并触发下载 (Convert data to JSON file and trigger download)
     * @param {Object} data - 要下载的数据对象 (Data object to download)
     * @param {string} filename - 文件名 (Filename)
     */
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * 清空文本 - Clear text
     * 清空输入框和所有分析结果 (Clear input box and all analysis results)
     */
    clearText() {
        const textInput = document.getElementById('textInput');
        textInput.value = '';
        
        // 隐藏分析结果区域 (Hide analysis results sections)
        document.getElementById('analyzedTextSection').style.display = 'none';
        document.getElementById('statistics').style.display = 'none';
        document.getElementById('highlightedWordsList').style.display = 'none';
        
        // 清空分析文本显示 (Clear analyzed text display)
        document.getElementById('analyzedText').innerHTML = '';
        
        // 重置统计数字 (Reset statistics)
        document.getElementById('totalWords').textContent = '0';
        document.getElementById('highlightedWords').textContent = '0';
        document.getElementById('newWords').textContent = '0';
        document.getElementById('difficultyScore').textContent = '0';
        
        // 清空高亮词汇列表 (Clear highlighted words list)
        document.getElementById('highlightedWordsContainer').innerHTML = '';
    }
}

// 页面加载完成后初始化应用 (Initialize app after page loads)
document.addEventListener('DOMContentLoaded', () => {
    window.wordDiscoverer = new WordDiscoverer();
});