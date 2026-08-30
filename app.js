/**
 * Word Discoverer Application
 * 单词发现应用 - 主入口文件
 * 
 * 应用架构 (Application Architecture):
 * - 采用模块化设计，分离核心逻辑和 UI 组件 (Modular design separating core logic and UI components)
 * - 使用 ECDICT 76万+ 词条数据库 (Using ECDICT database with 760,000+ entries)
 * - 渐进式加载数据库，优化首次加载速度 (Progressive database loading for faster initial load)
 * - 支持 Google Drive 云端同步 (Google Drive cloud synchronization support)
 * - 使用 DirectDataStorage 作为唯一数据访问层 (Uses DirectDataStorage as the only data access layer)
 * - 使用 requestIdleCallback 优化主线程性能 (Uses requestIdleCallback for better main thread performance)
 * 
 * 核心模块 (Core Modules):
 * - DirectDataStorage: 数据访问层 (Data access layer) - ONLY interface to database
 * - TextAnalyzer: 文本分析引擎 (Text analysis engine)
 * - VocabularyManager: 词汇管理 (Vocabulary management)
 * - SettingsManager: 设置管理 (Settings management)
 * 
 * UI 组件 (UI Components):
 * - VocabularyComponent: 词汇列表界面 (Vocabulary list interface)
 * - SettingsComponent: 设置界面 (Settings interface)
 * - AnalyzedTextComponent: 文本分析结果显示 (Analyzed text display)
 */

// Import CSS files - Vite will process these
import './css/main.css';
import './css/components.css';
import './css/ecdict-styles.css';
import './css/pronunciation-checker.css';
import './css/song-studio.css';

// Import JavaScript modules
import { DirectDataStorage } from './js/database/DirectDataStorage.js';
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

/**
 * Service Worker 管理
 * - 生产环境：注册 SW（离线支持 + 更新提示）
 * - dev 环境：不注册，并主动注销旧 SW、清理其缓存 —— sw.js 的 cacheFirst 策略
 *   会把 Vite 源码模块永久缓存，导致开发时页面一直运行旧代码
 */
(async function manageServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const base = import.meta.env.BASE_URL; // '/woaiios/'

    if (import.meta.env.PROD) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
                .then(registration => {
                    console.log('Service Worker registered successfully:', registration.scope);

                    // 检查更新 (Check for updates)
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New Service Worker found, installing...');

                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // 新版本可用，提示用户刷新 (New version available, prompt user to refresh)
                                console.log('New content available, please refresh!');
                                if (confirm('新版本可用！点击确定刷新页面以更新。\nNew version available! Click OK to refresh and update.')) {
                                    window.location.reload();
                                }
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });

            // 监听控制器变化 (Listen for controller change)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker controller changed, reloading page...');
                window.location.reload();
            });
        });
        return;
    }

    // dev：清理历史遗留的 SW 与缓存
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
        await reg.unregister();
    }
    if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => (k.startsWith('word-discoverer') ? caches.delete(k) : null)));
    }
    if (registrations.length > 0) {
        console.warn('[dev] 已注销遗留 Service Worker 并清理缓存，刷新一次以脱离旧 SW 控制');
        // 当前页面仍受旧 SW 控制：注销后重载一次即可彻底脱离（重载后无 controller，不会循环）
        if (navigator.serviceWorker.controller) {
            setTimeout(() => window.location.reload(), 300);
        }
    }
})();

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
        this.settingsManager = new SettingsManager();                           // 设置管理器 (Settings manager)
        this.dataStorage = new DirectDataStorage();                             // 数据访问层 (Data access layer) - ONLY interface to database
        this.vocabularyManager = new VocabularyManager();                       // 词汇管理器 (Vocabulary manager)
        this.textAnalyzer = new TextAnalyzer(this.dataStorage);                // 文本分析器 (Text analyzer)

        // UI 组件 (UI Components)
        this.vocabularyComponent = new VocabularyComponent(this.vocabularyManager);
        this.settingsComponent = new SettingsComponent(this.settingsManager, this.vocabularyManager.googleDriveManager);
        this.analyzedTextComponent = new AnalyzedTextComponent('#analyzedText', this.vocabularyManager);
        this.pronunciationCheckerComponent = new PronunciationCheckerComponent('#pronunciationModal');
        
        // 模块管理器 (Module Managers)
        this.eventHandlers = new EventHandlers(this);
        this.databaseProgress = new DatabaseProgress(this.dataStorage);
        
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
        this.renderBuildTime();
        
        // 初始化数据库加载进度管理
        this.databaseProgress.initialize();
        
        // 初始化数据存储层（chunk 1 就绪即返回；固定分片在后台继续加载）
        await this.dataStorage.initialize();

        // 门禁遮罩由 DatabaseProgress 在 pinnedComplete（数据库真正可用）时自动解除，
        // 期间全屏拦截操作并显示 下载/解压/连接数据库/建索引 阶段进度
        console.log('WordDiscoverer initialized successfully');
    }

    /**
     * 在页脚显示构建时间戳（精确到分钟，按访问者本地时区渲染）
     * - Display build timestamp in the footer (minute precision, viewer's local timezone)
     */
    renderBuildTime() {
        const el = document.getElementById('buildTime');
        if (!el) return;
        if (typeof __BUILD_TIME__ === 'undefined') return; // dev 模式无注入 (No injection in dev)

        const t = new Date(__BUILD_TIME__);
        if (isNaN(t.getTime())) return;

        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
        el.textContent = ` · Build ${stamp}`;
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

            // 异步用本地大模型结合上下文精修中文释义 (Asynchronously refine Chinese senses with local LLM)
            this.analyzedTextComponent.refineTranslationsWithLLM();

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