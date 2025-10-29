/**
 * AnalyzedText Component
 * 分析文本组件 - 负责显示和管理分析后的文本
 * 
 * 功能特性 (Features):
 * - 显示带高亮的已分析文本 (Display analyzed text with highlights)
 * - 处理单词点击事件 (Handle word click events)
 * - 显示单词操作模态框 (Show word action modal)
 * - 支持添加/掌握/取消掌握单词 (Support add/master/unmaster words)
 * - 实时刷新文本高亮状态 (Real-time refresh text highlight status)
 */
import { Component } from '../Component.js';

export class AnalyzedTextComponent extends Component {
    /**
     * 构造函数 - Constructor
     * @param {string} selector - 组件选择器 (Component selector)
     * @param {VocabularyManager} vocabularyManager - 词汇管理器实例 (Vocabulary manager instance)
     */
    constructor(selector, vocabularyManager) {
        super(selector);
        this.vocabularyManager = vocabularyManager;
        this.app = null;
        this.currentWord = null;  // 当前操作的单词 (Current word being operated on)
        this.currentTranslation = null;  // 当前单词的翻译 (Translation of current word)
    }

    /**
     * 设置应用实例引用 - Set app instance reference
     * @param {WordDiscoverer} app - 应用主实例 (Main app instance)
     */
    setApp(app) {
        this.app = app;
    }

    /**
     * 渲染处理后的文本 - Render processed text
     * @param {string} processedText - 处理后的HTML文本 (Processed HTML text)
     */
    render(processedText) {
        this.element.innerHTML = processedText;
        this.addEventListeners();
    }

    /**
     * 添加事件监听器 - Add event listeners
     * 使用事件委托优化性能 (Use event delegation for performance)
     */
    addEventListeners() {
        // 使用事件委托，监听父元素上的点击事件 (Use event delegation to listen for clicks on parent)
        this.element.addEventListener('click', (e) => {
            // 检查被点击的元素是否是单词span (Check if clicked element is a word span)
            if (e.target.classList.contains('word-span')) {
                const word = e.target.dataset.word;
                const translation = e.target.dataset.translation;
                // 显示单词操作模态框 (Show word action modal)
                this.showWordModal(word, translation, e);
            }
        });
    }

    /**
     * 显示单词操作模态框 - Show word action modal
     * @param {string} word - 单词 (Word)
     * @param {string} translation - 翻译 (Translation)
     * @param {Event} event - 点击事件对象 (Click event object)
     */
    showWordModal(word, translation, event) {
        this.currentWord = word;
        this.currentTranslation = translation;
        
        // 获取模态框元素 (Get modal elements)
        const modal = document.getElementById('wordModal');
        const modalContent = document.getElementById('wordModalContent');
        const modalTitle = document.getElementById('wordModalTitle');
        const modalTranslation = document.getElementById('wordModalTranslation');
        const modalActions = document.getElementById('wordModalActions');
        
        // 设置模态框内容 (Set modal content)
        modalTitle.textContent = word;
        // 检查翻译是否包含HTML标签 (Check if translation contains HTML tags)
        if (translation.includes('<') && translation.includes('>')) {
            // 如果是HTML，使用innerHTML渲染 (If it's HTML, use innerHTML to render)
            modalTranslation.innerHTML = translation;
        } else {
            // 如果是纯文本，使用textContent (If it's plain text, use textContent)
            modalTranslation.textContent = translation;
        }
        
        // 清空操作按钮容器 (Clear action buttons container)
        modalActions.innerHTML = '';
        
        // 根据单词状态添加操作按钮 (Add action buttons based on word status)
        if (this.vocabularyManager.masteredWords.has(word)) {
            // 单词已在掌握列表中 (Word is in mastered list)
            const unmasterBtn = document.createElement('button');
            unmasterBtn.textContent = 'Move to Learning List';
            unmasterBtn.className = 'btn btn-secondary';
            unmasterBtn.onclick = () => {
                this.handleWordUnmaster(word);
                this.closeWordModal();
            };
            modalActions.appendChild(unmasterBtn);
        } else if (this.vocabularyManager.learningWords.has(word)) {
            // 单词已在学习列表中 (Word is in learning list)
            const masterBtn = document.createElement('button');
            masterBtn.textContent = 'Mark as Mastered';
            masterBtn.className = 'btn btn-primary';
            masterBtn.onclick = () => {
                this.handleWordMaster(word, translation);
                this.closeWordModal();
            };
            modalActions.appendChild(masterBtn);
        } else {
            // 单词不在任何列表中 (Word is not in any list)
            const addToLearningBtn = document.createElement('button');
            addToLearningBtn.textContent = 'Add to Learning List';
            addToLearningBtn.className = 'btn btn-primary';
            addToLearningBtn.onclick = () => {
                this.handleWordAddToLearning(word, translation);
                this.closeWordModal();
            };
            modalActions.appendChild(addToLearningBtn);
            
            const addToMasteredBtn = document.createElement('button');
            addToMasteredBtn.textContent = 'Add to Mastered List';
            addToMasteredBtn.className = 'btn btn-secondary';
            addToMasteredBtn.onclick = () => {
                this.handleWordMaster(word, translation);
                this.closeWordModal();
            };
            modalActions.appendChild(addToMasteredBtn);
        }
        
        // 添加关闭按钮 (Add close button)
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn btn-outline';
        closeBtn.onclick = () => this.closeWordModal();
        modalActions.appendChild(closeBtn);
        
        // 显示模态框 (positioning handled by CSS) (Show modal, positioning handled by CSS)
        modal.classList.add('show');
        
        // 添加点击背景关闭模态框的事件监听器 (Add click backdrop to close modal listener)
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeWordModal();
            }
        };
    }

    /**
     * 关闭单词模态框 - Close word modal
     */
    closeWordModal() {
        const modal = document.getElementById('wordModal');
        modal.classList.remove('show');
    }

    /**
     * 处理添加单词到学习列表 - Handle adding word to learning list
     * @param {string} word - 单词 (Word)
     * @param {string} translation - 翻译 (Translation)
     */
    handleWordAddToLearning(word, translation) {
        const result = this.vocabularyManager.addWord(word, translation);
        if (result) {
            this.app.showNotification(`📖 '${word}' added to learning list.`);
        }
        this.app.updateCounts();
        this.refreshTextAnalysis();
    }

    /**
     * 处理标记单词为已掌握 - Handle marking word as mastered
     * @param {string} word - 单词 (Word)
     * @param {string} translation - 翻译 (Translation)
     */
    handleWordMaster(word, translation) {
        const result = this.vocabularyManager.masterWord(word, translation);
        if (result === 'added_to_mastered' || result === 'moved_to_mastered') {
            this.app.showNotification(`✅ '${word}' marked as mastered.`);
        }
        this.app.updateCounts();
        this.refreshTextAnalysis();
    }

    /**
     * 处理取消掌握单词 - Handle unmarking word as mastered
     * @param {string} word - 单词 (Word)
     */
    handleWordUnmaster(word) {
        const result = this.vocabularyManager.unmasterWord(word);
        if (result === 'moved_to_learning') {
            this.app.showNotification(`📖 '${word}' moved to learning list.`);
            this.app.updateCounts();
        }
        this.refreshTextAnalysis();
    }
    
    /**
     * 重新分析并刷新文本高亮 - Re-analyze and refresh text highlights
     * 当词汇状态改变时更新文本中的高亮显示 (Update highlights in text when vocabulary status changes)
     */
    refreshTextAnalysis() {
        // 获取当前显示的文本内容 (Get currently displayed text content)
        const currentText = document.getElementById('textInput').value;
        if (!currentText) return;
        
        // 使用集中的分析方法 (Use centralized analysis method)
        const analysis = this.app.performTextAnalysis(currentText);
        const processedText = this.app.textAnalyzer.processTextForDisplay(currentText, analysis);
        this.render(processedText);
        
        // 更新统计信息（仅在主页面时）(Update statistics - only on main page)
        if (this.app.updateStatistics) {
            this.app.updateStatistics(analysis);
        }
    }
}