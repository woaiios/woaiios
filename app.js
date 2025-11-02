/**
 * Word Discoverer Application
 * 单词发现应用 - 主入口文件
 * 
 * 应用架构 (Application Architecture):
 * - 采用模块化设计，分离核心逻辑和 UI 组件 (Modular design separating core logic and UI components)
 * - 使用 ECDICT 76万+ 词条数据库 (Using ECDICT database with 760,000+ entries)
 * - 渐进式加载数据库，优化首次加载速度 (Progressive database loading for faster initial load)
 * - 支持 Google Drive 云端同步 (Google Drive cloud synchronization support)
 * - 使用 Web Workers 处理耗时操作 (Uses Web Workers for intensive operations)
 * - 使用 requestIdleCallback 优化主线程性能 (Uses requestIdleCallback for better main thread performance)
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
import { PronunciationCheckerComponent } from './components/PronunciationChecker/PronunciationChecker.js';
import { batchDOMUpdate, scheduleIdleTask } from './js/PerformanceUtils.js';
import { NotificationManager } from './js/modules/NotificationManager.js';
import { UIRenderer } from './js/modules/UIRenderer.js';
import { DatabaseProgress } from './js/modules/DatabaseProgress.js';
import { EventHandlers } from './js/modules/EventHandlers.js';
import { FileUtils } from './js/modules/FileUtils.js';

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
        this.pronunciationCheckerComponent = new PronunciationCheckerComponent('#pronunciationModal');
        
        // 模块管理器 (Module Managers)
        this.eventHandlers = new EventHandlers(this);
        this.databaseProgress = new DatabaseProgress(this.wordDatabase);
        
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
        this.eventHandlers.addAll();
        this.updateCounts();
        
        // 初始化数据库加载进度管理
        this.databaseProgress.initialize();
        
        // 初始化数据库
        await this.wordDatabase.initialize();
        
        // 首批数据加载完成后隐藏遮罩（应用已可用）
        this.databaseProgress.hideAfterFirstLoad();
        
        console.log('WordDiscoverer initialized successfully');
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
            NotificationManager.show('Please enter some text to analyze.', 'error');
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
            UIRenderer.showAnalysisResults();
            
            // 更新统计信息和高亮词列表 (Update statistics and highlighted words list)
            UIRenderer.updateStatistics(analysis);
            UIRenderer.displayHighlightedWords(analysis.highlightedWords);

        } catch (error) {
            console.error('Analysis error:', error);
            NotificationManager.show('Error analyzing text. Please try again.', 'error');
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
     * 更新词汇数量显示 - Update vocabulary counts
     * 刷新词汇组件中的学习和已掌握单词数量 (Refresh learning and mastered word counts in vocabulary component)
     * Uses batchDOMUpdate to avoid layout thrashing
     */
    updateCounts() {
        batchDOMUpdate(() => {
            this.vocabularyComponent.updateCounts();
        });
    }
}

// 页面加载完成后初始化应用 (Initialize app after page loads)
document.addEventListener('DOMContentLoaded', () => {
    window.wordDiscoverer = new WordDiscoverer();
});