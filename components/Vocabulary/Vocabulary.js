/**
 * Vocabulary Component
 * 词汇组件 - 管理和显示用户的词汇表
 * 
 * 功能特性 (Features):
 * - 双列表管理：学习列表和已掌握列表 (Dual lists: learning and mastered)
 * - 词汇导入/导出 (Import/export vocabulary)
 * - 词汇状态切换（学习 ⇄ 已掌握）(Switch word status: learning ⇄ mastered)
 * - 词汇删除和清空 (Delete and clear vocabulary)
 * - 按日期排序显示 (Display sorted by date)
 * 
 * @class VocabularyComponent
 */
import { Modal } from '../Modal/Modal.js';

export class VocabularyComponent {
    /**
     * 构造函数 - Constructor
     * @param {VocabularyManager} vocabularyManager - 词汇管理器实例 (Vocabulary manager instance)
     */
    constructor(vocabularyManager) {
        this.vocabularyManager = vocabularyManager;
        this.modal = new Modal('#vocabularyModal', 'My Vocabulary');
        this.app = null; // 将由主应用设置 (Will be set by the main app)
    }

    /**
     * 设置应用实例引用 - Set app instance reference
     * @param {WordDiscoverer} app - 主应用实例 (Main app instance)
     */
    setApp(app) {
        this.app = app;
    }

    /**
     * 打开词汇模态框 - Open vocabulary modal
     * 渲染内容，添加事件监听器，更新列表 (Render content, add event listeners, update lists)
     */
    open() {
        this.modal.open(this.renderContent());
        this.addEventListeners();
        this.updateAndRenderLists();
    }

    /**
     * 添加事件监听器 - Add event listeners
     * 设置标签切换、导入/导出和清空按钮的事件 (Set up events for tabs, import/export, and clear buttons)
     */
    addEventListeners() {
        // 标签页切换 (Tab switching)
        document.querySelectorAll('.vocab-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabClick(e));
        });
        // 导出按钮 (Export button)
        document.getElementById('exportVocabBtn').addEventListener('click', () => this.onExportVocabulary());
        // 导入按钮（触发文件选择）(Import button - trigger file selection)
        document.getElementById('importVocabBtn').addEventListener('click', () => document.getElementById('importFile').click());
        // 文件选择变化 (File selection change)
        document.getElementById('importFile').addEventListener('change', (e) => this.onImportFileChange(e));
        // 清空按钮 (Clear button)
        document.getElementById('clearVocabBtn').addEventListener('click', () => this.onClearVocabulary());
    }

    /**
     * 渲染模态框内容 - Render modal content
     * 生成词汇管理界面的 HTML 结构 (Generate HTML structure for vocabulary management interface)
     * @returns {string} HTML 字符串 (HTML string)
     */
    renderContent() {
        return `
            <div class="vocab-controls">
                <button class="btn btn-primary" id="exportVocabBtn"><i class="fas fa-download"></i> Export</button>
                <button class="btn btn-secondary" id="importVocabBtn"><i class="fas fa-upload"></i> Import</button>
                <input type="file" id="importFile" accept=".json" style="display: none;">
                <button class="btn btn-danger" id="clearVocabBtn"><i class="fas fa-trash"></i> Clear All</button>
            </div>
            <div class="vocab-tabs">
                <button class="vocab-tab active" data-tab="learning">Learning (<span id="learning-count">0</span>)</button>
                <button class="vocab-tab" data-tab="mastered">Mastered (<span id="mastered-count">0</span>)</button>
            </div>
            <div id="learning-list-container" class="vocab-tab-content active">
                <div class="vocab-list" id="learning-list"></div>
            </div>
            <div id="mastered-list-container" class="vocab-tab-content">
                <div class="vocab-list" id="mastered-list"></div>
            </div>
        `;
    }

    /**
     * 更新并渲染词汇列表 - Update and render vocabulary lists
     * 刷新学习列表和已掌握列表的显示 (Refresh display of learning and mastered lists)
     */
    updateAndRenderLists() {
        const learningListEl = document.getElementById('learning-list');
        const masteredListEl = document.getElementById('mastered-list');
        if (!learningListEl || !masteredListEl) return;

        // 获取按日期排序的词汇 (Get vocabulary sorted by date)
        const learningWords = this.vocabularyManager.getSortedByDate(this.vocabularyManager.learningWords);
        this.renderList(learningListEl, learningWords, 'learning');

        const masteredWords = this.vocabularyManager.getSortedByDate(this.vocabularyManager.masteredWords);
        this.renderList(masteredListEl, masteredWords, 'mastered');
        
        this.updateCounts();
    }

    /**
     * 渲染单个词汇列表 - Render a single vocabulary list
     * @param {HTMLElement} element - 目标容器元素 (Target container element)
     * @param {Array} wordList - 词汇数组 (Word array)
     * @param {string} type - 列表类型：'learning' 或 'mastered' (List type: 'learning' or 'mastered')
     */
    renderList(element, wordList, type) {
        element.innerHTML = '';
        if (wordList.length === 0) {
            element.innerHTML = `<p style="text-align: center; color: #6b7280; padding: 2rem;">No words in this list yet.</p>`;
            return;
        }

        wordList.forEach(([word, data]) => {
            // 根据列表类型生成不同的操作按钮 (Generate different action buttons based on list type)
            const actionButton = type === 'learning'
                ? `<button class="btn btn-sm btn-success master-btn" data-word="${word}"><i class="fas fa-check"></i> Master</button>`
                : `<button class="btn btn-sm btn-info unmaster-btn" data-word="${word}"><i class="fas fa-undo"></i> Learn</button>`;

            const vocabItem = document.createElement('div');
            vocabItem.className = 'vocab-item';
            vocabItem.innerHTML = `
                <div>
                    <div class="vocab-word">${word}</div>
                    <div class="vocab-translation">${data.translation}</div>
                    <div class="vocab-meta">Added: ${new Date(data.addedDate).toLocaleDateString()}</div>
                </div>
                <div class="vocab-actions">
                    ${actionButton}
                    <button class="btn btn-sm btn-danger delete-btn" data-word="${word}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            element.appendChild(vocabItem);
        });

        // 为新按钮添加事件监听器 (Add event listeners for the new buttons)
        element.querySelectorAll('.master-btn').forEach(btn => btn.addEventListener('click', (e) => this.masterWord(e.currentTarget.dataset.word)));
        element.querySelectorAll('.unmaster-btn').forEach(btn => btn.addEventListener('click', (e) => this.unmasterWord(e.currentTarget.dataset.word)));
        element.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => this.removeFromVocabulary(e.currentTarget.dataset.word)));
    }

    /**
     * 更新词汇数量显示 - Update vocabulary counts
     * 更新页面和模态框中的词汇数量 (Update vocabulary counts on page and in modal)
     */
    updateCounts() {
        const learningSize = this.vocabularyManager.getLearningSize();
        const masteredSize = this.vocabularyManager.masteredWords.size;
        
        // 更新主页面的词汇数量 (Update vocabulary count on main page)
        const vocabCountEl = document.getElementById('vocabCount');
        if (vocabCountEl) {
            vocabCountEl.textContent = learningSize;
        }

        // 只在模态框打开时更新（元素存在于 DOM 中）(Only update modal counts if modal is open)
        const learningCountEl = document.getElementById('learning-count');
        if (learningCountEl) {
            learningCountEl.textContent = learningSize;
        }

        const masteredCountEl = document.getElementById('mastered-count');
        if (masteredCountEl) {
            masteredCountEl.textContent = masteredSize;
        }
    }

    /**
     * 处理标签页切换 - Handle tab click
     * 切换学习列表和已掌握列表的显示 (Switch between learning and mastered list display)
     * @param {Event} event - 点击事件 (Click event)
     */
    handleTabClick(event) {
        const clickedTab = event.target;
        const tabName = clickedTab.dataset.tab;
        // 移除所有活动标签 (Remove all active tabs)
        document.querySelectorAll('.vocab-tab').forEach(tab => tab.classList.remove('active'));
        clickedTab.classList.add('active');
        // 显示对应的内容 (Show corresponding content)
        document.querySelectorAll('.vocab-tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-list-container`).classList.add('active');
    }

    /**
     * 标记单词为已掌握 - Mark word as mastered
     * 将单词从学习列表移动到已掌握列表 (Move word from learning to mastered list)
     * @param {string} word - 单词 (Word)
     */
    async masterWord(word) {
        const result = await this.vocabularyManager.masterWord(word);
        if (result) {
            this.updateAndRenderLists();
            this.app.showNotification(`'${word}' moved to mastered list.`);
            this.app.refreshTextAnalysis(); // 刷新文本分析以更新高亮 (Refresh text analysis to update highlights)
        }
    }

    /**
     * 取消掌握单词 - Unmaster word
     * 将单词从已掌握列表移回学习列表 (Move word from mastered back to learning list)
     * @param {string} word - 单词 (Word)
     */
    async unmasterWord(word) {
        const result = await this.vocabularyManager.unmasterWord(word);
        if (result) {
            this.updateAndRenderLists();
            this.app.showNotification(`'${word}' moved back to learning list.`);
            this.app.refreshTextAnalysis(); // 刷新文本分析以更新高亮 (Refresh text analysis to update highlights)
        }
    }

    /**
     * 从词汇表中删除单词 - Remove word from vocabulary
     * 永久删除单词（需要确认）(Permanently delete word - requires confirmation)
     * @param {string} word - 单词 (Word)
     */
    async removeFromVocabulary(word) {
        if (confirm(`Are you sure you want to permanently delete "${word}"?`)) {
            const result = await this.vocabularyManager.removeWord(word);
            if (result) {
                this.updateAndRenderLists();
                this.app.showNotification(`'${word}' has been deleted.`, 'info');
                this.app.refreshTextAnalysis(); // 刷新文本分析以更新高亮 (Refresh text analysis to update highlights)
            }
        }
    }

    /**
     * 导出词汇 - Export vocabulary
     * 将词汇表导出为 JSON 文件 (Export vocabulary to JSON file)
     */
    onExportVocabulary() {
        const data = this.vocabularyManager.exportVocabulary();
        this.app.downloadJSON(data, 'word-discoverer-vocabulary.json');
        this.app.showNotification('Vocabulary exported successfully!');
    }

    /**
     * 处理导入文件选择 - Handle import file selection
     * 读取并导入 JSON 格式的词汇文件 (Read and import vocabulary from JSON file)
     * @param {Event} event - 文件选择事件 (File selection event)
     */
    onImportFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (this.vocabularyManager.importVocabulary(data)) {
                    this.updateAndRenderLists();
                    this.app.showNotification('Vocabulary imported successfully!');
                    this.app.refreshTextAnalysis(); // 刷新文本分析以更新高亮 (Refresh text analysis to update highlights)
                } else {
                    this.app.showNotification('Error importing vocabulary. Check file format.', 'error');
                }
            } catch (error) {
                this.app.showNotification('Error importing vocabulary. Check file format.', 'error');
            }
        };
        reader.readAsText(file);
    }

    /**
     * 清空所有词汇 - Clear all vocabulary
     * 删除所有学习和已掌握的单词（需要确认）(Delete all learning and mastered words - requires confirmation)
     */
    async onClearVocabulary() {
        if (confirm('Clear all vocabulary (both learning and mastered)? This action cannot be undone.')) {
            await this.vocabularyManager.clearVocabulary();
            this.updateAndRenderLists();
            this.app.showNotification('All vocabulary has been cleared.');
            this.app.refreshTextAnalysis(); // 刷新文本分析以更新高亮 (Refresh text analysis to update highlights)
        }
    }
}