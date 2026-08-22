import { Component } from '../Component.js';

export class AnalyzedTextComponent extends Component {
    constructor(selector, vocabularyManager) {
        super(selector);
        this.vocabularyManager = vocabularyManager;
        this.app = null;
        this.currentWord = null;
        this.currentTranslation = null;
        
        // Register delegated click listener once in constructor
        this.element.addEventListener('click', (e) => {
            if (e.target.classList.contains('word-span')) {
                const word = e.target.dataset.word;
                const translation = e.target.dataset.translation;
                this.showWordModal(word, translation, e);
            }
        });
    }

    setApp(app) {
        this.app = app;
    }

    render(processedText) {
        this.element.innerHTML = processedText;
    }

    showWordModal(word, translation, event) {
        this.currentWord = word;
        this.currentTranslation = translation;
        
        // 获取模态框元素
        const modal = document.getElementById('wordModal');
        const modalContent = document.getElementById('wordModalContent');
        const modalTitle = document.getElementById('wordModalTitle');
        const modalTranslation = document.getElementById('wordModalTranslation');
        const modalActions = document.getElementById('wordModalActions');
        
        // 设置模态框内容
        modalTitle.textContent = word;
        // Check if translation is HTML content (contains HTML tags)
        if (translation.includes('<') && translation.includes('>')) {
            // If it's HTML, use innerHTML to render it properly
            modalTranslation.innerHTML = translation;
        } else {
            // If it's plain text, use textContent
            modalTranslation.textContent = translation;
        }
        
        // 清空操作按钮容器
        modalActions.innerHTML = '';
        
        // 根据单词状态添加操作按钮
        // 词汇表键统一为小写（见 VocabularyManager），查询时必须先转换大小写
        const lowerCaseWord = word.toLowerCase();
        if (this.vocabularyManager.masteredWords.has(lowerCaseWord)) {
            // 单词已在掌握列表中
            const unmasterBtn = document.createElement('button');
            unmasterBtn.textContent = 'Move to Learning List';
            unmasterBtn.className = 'btn btn-secondary';
            unmasterBtn.onclick = () => {
                this.handleWordUnmaster(word);
                this.closeWordModal();
            };
            modalActions.appendChild(unmasterBtn);
        } else if (this.vocabularyManager.learningWords.has(lowerCaseWord)) {
            // 单词已在学习列表中
            const masterBtn = document.createElement('button');
            masterBtn.textContent = 'Mark as Mastered';
            masterBtn.className = 'btn btn-primary';
            masterBtn.onclick = () => {
                this.handleWordMaster(word, translation);
                this.closeWordModal();
            };
            modalActions.appendChild(masterBtn);
        } else {
            // 单词不在任何列表中
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
        
        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn btn-outline';
        closeBtn.onclick = () => this.closeWordModal();
        modalActions.appendChild(closeBtn);
        
        // 显示模态框 (positioning handled by CSS)
        modal.classList.add('show');
        
        // 添加点击背景关闭模态框的事件监听器
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeWordModal();
            }
        };
    }

    closeWordModal() {
        const modal = document.getElementById('wordModal');
        modal.classList.remove('show');
    }

    handleWordAddToLearning(word, translation) {
        const result = this.vocabularyManager.addWord(word, translation);
        if (result) {
            this.app.showNotification(`📖 '${word}' added to learning list.`);
        }
        this.app.updateCounts();
        this.updateWordSpans();
        this.refreshStatistics();
    }

    handleWordMaster(word, translation) {
        const result = this.vocabularyManager.masterWord(word, translation);
        if (result === 'added_to_mastered' || result === 'moved_to_mastered') {
            this.app.showNotification(`✅ '${word}' marked as mastered.`);
        }
        this.app.updateCounts();
        this.updateWordSpans();
        this.refreshStatistics();
    }

    handleWordUnmaster(word) {
        const result = this.vocabularyManager.unmasterWord(word);
        if (result === 'moved_to_learning') {
            this.app.showNotification(`📖 '${word}' moved to learning list.`);
            this.app.updateCounts();
        }
        this.updateWordSpans();
        this.refreshStatistics();
    }

    // 更新统计信息（仅在主页面可用时）
    refreshStatistics() {
        if (!this.app.updateStatistics) return;
        const textInput = document.getElementById('textInput');
        if (!textInput) return;
        const currentText = textInput.value;
        if (!currentText) return;
        const analysis = this.app.performTextAnalysis(currentText);
        this.app.updateStatistics(analysis);
        // Also refresh the highlighted-words list so counts stay consistent.
        if (this.app.displayHighlightedWords) {
            this.app.displayHighlightedWords(analysis.highlightedWords);
        }
    }
    
    // 重新分析并刷新文本高亮
    refreshTextAnalysis() {
        // 获取当前显示的文本内容
        const currentText = document.getElementById('textInput').value;
        if (!currentText) return;
        
        // Use the centralized analysis method
        const analysis = this.app.performTextAnalysis(currentText);
        const processedText = this.app.textAnalyzer.processTextForDisplay(currentText, analysis);
        this.render(processedText);
        
        // 更新统计信息 (only if we're on the main page)
        if (this.app.updateStatistics) {
            this.app.updateStatistics(analysis);
        }
    }
    
    // Update word spans directly without full re-render
    updateWordSpans() {
        const wordSpans = this.element.querySelectorAll('.word-span');
        wordSpans.forEach(span => {
            // 词汇表键统一为小写（见 VocabularyManager），查询时必须先转换大小写
            const word = span.dataset.word.toLowerCase();
            const isLearning = this.vocabularyManager.learningWords.has(word);
            const isMastered = this.vocabularyManager.masteredWords.has(word);
            
            // Update CSS classes based on vocabulary status
            span.classList.toggle('in-vocabulary', isLearning || isMastered);
            span.classList.toggle('learning', isLearning);
            span.classList.toggle('mastered', isMastered);
        });
    }
}