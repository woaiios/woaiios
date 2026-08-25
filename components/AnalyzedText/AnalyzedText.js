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
import { NotificationManager } from '../../js/modules/NotificationManager.js';
import { LLMSenseSelector } from '../../js/analyzers/LLMSenseSelector.js';

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
        this.llmSenseSelector = new LLMSenseSelector();  // LLM 上下文释义选择器 (LLM context sense selector)
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
            // 检查被点击的元素是否是单词span或ruby元素 (Check if clicked element is a word span or ruby element)
            let targetElement = e.target;
            
            // If clicked on rb or rt element, get the parent ruby element
            // Use toUpperCase() for consistent comparison across browsers
            if (targetElement.tagName.toUpperCase() === 'RB' || targetElement.tagName.toUpperCase() === 'RT') {
                targetElement = targetElement.parentElement;
            }
            
            // If clicked on ruby or base span inside double-ruby, get the parent double-ruby container
            if (targetElement.tagName.toUpperCase() === 'RUBY' || targetElement.classList.contains('base')) {
                targetElement = targetElement.parentElement;
            }
            
            if (targetElement.classList.contains('word-span')) {
                const word = targetElement.dataset.word;
                const translation = targetElement.dataset.translation;
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
    async showWordModal(word, translation, event) {
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
        if (translation) {
            if (translation.includes('<') && translation.includes('>')) {
                // 如果是HTML，使用innerHTML渲染 (If it's HTML, use innerHTML to render)
                modalTranslation.innerHTML = translation;
            } else {
                // 如果是纯文本，使用textContent (If it's plain text, use textContent)
                modalTranslation.textContent = translation;
            }
        } else {
            // 非高亮单词通常没有预取翻译，先显示加载状态 (Non-highlighted words usually have no prefetched translation)
            modalTranslation.textContent = '正在加载翻译...';
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
                this.handleWordMaster(word, this.currentTranslation);
                this.closeWordModal();
            };
            modalActions.appendChild(masterBtn);
        } else {
            // 单词不在任何列表中 (Word is not in any list)
            const addToLearningBtn = document.createElement('button');
            addToLearningBtn.textContent = 'Add to Learning List';
            addToLearningBtn.className = 'btn btn-primary';
            addToLearningBtn.onclick = () => {
                this.handleWordAddToLearning(word, this.currentTranslation);
                this.closeWordModal();
            };
            modalActions.appendChild(addToLearningBtn);
            
            const addToMasteredBtn = document.createElement('button');
            addToMasteredBtn.textContent = 'Add to Mastered List';
            addToMasteredBtn.className = 'btn btn-secondary';
            addToMasteredBtn.onclick = () => {
                this.handleWordMaster(word, this.currentTranslation);
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
        
        // 非高亮单词没有预取翻译时，打开后再按需查询 (Fetch translation on demand for non-highlighted words)
        if (!translation) {
            await this.loadTranslationForModal(word, modal, modalTranslation);
        }
    }
    
    /**
     * 按需加载单词翻译 - Load translation on demand
     * @param {string} word - 单词 (Word)
     * @param {HTMLElement} modal - 模态框元素 (Modal element)
     * @param {HTMLElement} modalTranslation - 翻译容器 (Translation element)
     */
    async loadTranslationForModal(word, modal, modalTranslation) {
        try {
            const fetchedTranslation = await this.app.textAnalyzer.getTranslation(word);
            
            // 用户已经切换单词/关闭弹窗时，不更新旧内容 (Don't update if user switched words or closed the modal)
            if (this.currentWord !== word || !modal.classList.contains('show')) {
                return;
            }
            
            this.currentTranslation = fetchedTranslation;
            if (fetchedTranslation) {
                if (fetchedTranslation.includes('<') && fetchedTranslation.includes('>')) {
                    modalTranslation.innerHTML = fetchedTranslation;
                } else {
                    modalTranslation.textContent = fetchedTranslation;
                }
            } else {
                modalTranslation.textContent = '数据库未加载，请稍后重试';
            }
        } catch (error) {
            console.error('Failed to load translation:', error);
            modalTranslation.textContent = '翻译加载失败，请重试';
        }
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
    async handleWordAddToLearning(word, translation) {
        const result = await this.vocabularyManager.addWord(word, translation);
        if (result) {
            NotificationManager.show(`📖 '${word}' added to learning list.`);
        }
        this.app.updateCounts();
        await this.app.analyzeText();
    }

    /**
     * 处理标记单词为已掌握 - Handle marking word as mastered
     * @param {string} word - 单词 (Word)
     * @param {string} translation - 翻译 (Translation)
     */
    async handleWordMaster(word, translation) {
        const result = await this.vocabularyManager.masterWord(word, translation);
        if (result === 'added_to_mastered' || result === 'moved_to_mastered') {
            NotificationManager.show(`✅ '${word}' marked as mastered.`);
        }
        this.app.updateCounts();
        await this.app.analyzeText();
    }

    /**
     * 处理取消掌握单词 - Handle unmarking word as mastered
     * @param {string} word - 单词 (Word)
     */
    async handleWordUnmaster(word) {
        const result = await this.vocabularyManager.unmasterWord(word);
        if (result === 'moved_to_learning') {
            NotificationManager.show(`📖 '${word}' moved to learning list.`);
            this.app.updateCounts();
        }
        await this.app.analyzeText();
    }

    /**
     * 用本地大模型结合上下文精修高亮单词的中文释义 (Refine Chinese senses with local LLM)
     * 先展示词典首个释义，随后异步替换为更贴合语境的释义 (Show dictionary sense first, refine asynchronously)
     */
    async refineTranslationsWithLLM() {
        try {
            const settingsManager = this.app?.settingsManager;
            if (settingsManager?.waitForInit) {
                await settingsManager.waitForInit();
            }
            if (settingsManager && settingsManager.getSetting('llmSenseEnabled') === false) {
                return;
            }

            // 应用最新端点/模型配置 (Apply latest endpoint/model settings)
            this.llmSenseSelector.configure({
                endpoint: settingsManager?.getSetting('llmEndpoint'),
                model: settingsManager?.getSetting('llmModel')
            });

            const occurrences = this.collectHighlightedOccurrences();
            if (!occurrences.length || this.llmSenseSelector.disabled) return;

            const payload = occurrences.map((occ, i) => ({
                id: i,
                word: occ.word,
                context: occ.context,
                dictionarySenses: this.extractDictionarySenses(occ.element)
            }));

            const results = await this.llmSenseSelector.selectSenses(payload, {
                backgroundText: this.getSourceText()
            });

            let updated = 0;
            results.forEach((gloss, id) => {
                const occ = occurrences[id];
                if (!occ || !gloss) return;
                // 用户可能已重新分析文本，校验元素仍在文档中 (Skip if re-analyzed meanwhile)
                if (!occ.element.isConnected) return;
                const rt = occ.element.querySelector('ruby.under rt');
                if (rt && rt.textContent !== gloss) {
                    rt.textContent = gloss;
                    updated += 1;
                }
            });
            if (updated > 0) {
                console.log(`✅ LLM refined ${updated} word sense(s) by context`);
            }
        } catch (error) {
            console.warn('⚠️ LLM sense refinement skipped:', error.message);
        }
    }

    /**
     * 获取当前原文整段文本（用作 LLM 背景信息，扩大上下文窗口）
     * (Get full source passage for LLM background context)
     * @returns {string}
     */
    getSourceText() {
        try {
            const ta = document.getElementById('textInput');
            return ta ? ta.value : '';
        } catch {
            return '';
        }
    }

    /**
     * 收集所有高亮单词及其所在句子上下文（仅高亮词，非全部单词）
     * (Collect HIGHLIGHTED words only, with sentence context)
     *
     * 渲染后的 DOM 子节点顺序与原文分词顺序一致：文本节点 + 词 span。
     * 通过顺序遍历重建原文（span 取 .base 文本），从而得到每个词在原文中的精确偏移，
     * 再向两侧扩展到句子边界作为上下文窗口。
     *
     * @returns {Array<{element:HTMLElement, word:string, context:string}>}
     */
    collectHighlightedOccurrences() {
        const occurrences = [];
        let text = '';
        const positions = [];

        for (const node of this.element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
                continue;
            }
            // Only highlighted spans need LLM refinement
            if (node.nodeType !== Node.ELEMENT_NODE ||
                !node.classList.contains('word-span') ||
                !node.classList.contains('highlight')) {
                continue;
            }
            const base = node.querySelector('.base');
            const wordText = base ? base.textContent : node.dataset.word || '';
            positions.push({ element: node, start: text.length, end: text.length + wordText.length });
            text += wordText;
        }

        for (const pos of positions) {
            occurrences.push({
                element: pos.element,
                word: pos.element.dataset.word,
                context: this.extractSentenceContext(text, pos.start, pos.end)
            });
        }
        return occurrences;
    }

    /**
     * 提取包含指定区间的句子上下文 (Extract sentence containing [start, end))
     * @param {string} text - 重建的完整原文 (Rebuilt full text)
     * @param {number} start - 目标词起始偏移 (Word start offset)
     * @param {number} end - 目标词结束偏移 (Word end offset)
     * @returns {string} 句子上下文 (Sentence context)
     */
    extractSentenceContext(text, start, end, maxWindow = 200) {
        const boundaryRegex = /[.!?。！？\n]["')】」”]*\s/;
        // 向前找句子开始 (Find sentence start backwards)
        let sentStart = 0;
        for (let i = start - 1; i >= 0 && start - i < maxWindow; i--) {
            if (boundaryRegex.test(text.slice(i, i + 2))) {
                sentStart = i + 1;
                break;
            }
        }
        // 向后找句子结束 (Find sentence end forwards)
        let sentEnd = Math.min(text.length, start + maxWindow);
        for (let i = Math.max(end, start + 1); i < Math.min(text.length, start + maxWindow); i++) {
            if (/[.!?。！？]/.test(text[i])) {
                sentEnd = i + 1;
                break;
            }
        }
        return text.slice(sentStart, sentEnd).trim();
    }

    /**
     * 从词条 HTML 中提取全部中文释义候选 (Extract candidate senses from translation HTML)
     * @param {HTMLElement} element - 词元素 (Word element with data-translation)
     * @returns {string} 以分号连接的释义串 (Semicolon-joined senses)
     */
    extractDictionarySenses(element) {
        const html = element.dataset.translation;
        if (!html) return '';
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const parts = [];
            doc.querySelectorAll('.translation-compact p, .translation p').forEach(p => {
                const t = p.textContent.trim();
                if (t && !parts.includes(t)) parts.push(t);
            });
            return parts.join('; ');
        } catch {
            return '';
        }
    }
}