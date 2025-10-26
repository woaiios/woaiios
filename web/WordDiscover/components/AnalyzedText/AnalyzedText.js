import { Component } from '../Component.js';

export class AnalyzedTextComponent extends Component {
    constructor(selector, vocabularyManager) {
        super(selector);
        this.vocabularyManager = vocabularyManager;
        this.app = null;
        this.currentWord = null;
        this.currentTranslation = null;
    }

    setApp(app) {
        this.app = app;
    }

    render(processedText) {
        this.element.innerHTML = processedText;
        this.addEventListeners();
    }

    addEventListeners() {
        // 使用事件委托，监听父元素上的点击事件
        this.element.addEventListener('click', (e) => {
            // 检查被点击的元素是否是单词span
            if (e.target.classList.contains('word-span')) {
                const word = e.target.dataset.word;
                const translation = e.target.dataset.translation;
                // 显示单词操作模态框
                this.showWordModal(word, translation, e);
            }
        });
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
        modalTranslation.textContent = translation;
        
        // 清空之前的操作按钮
        modalActions.innerHTML = '';
        
        // 创建操作按钮
        if (this.vocabularyManager.masteredWords.has(word)) {
            // 单词已在掌握列表中
            const unmasterBtn = document.createElement('button');
            unmasterBtn.textContent = 'Move to Learning List';
            unmasterBtn.className = 'btn btn-secondary';
            unmasterBtn.onclick = () => {
                this.handleWordUnmaster(word);
                this.closeWordModal();
            };
            modalActions.appendChild(unmasterBtn);
        } else if (this.vocabularyManager.learningWords.has(word)) {
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
        
        // 设置模态框位置
        modalContent.style.top = `${event.clientY + 10}px`;
        modalContent.style.left = `${event.clientX}px`;
        modalContent.style.transform = 'translate(-50%, 0)';
        
        // 确保模态框不会超出视窗边界
        setTimeout(() => {
            const rect = modalContent.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                modalContent.style.left = 'auto';
                modalContent.style.right = '10px';
            }
            if (rect.bottom > window.innerHeight) {
                modalContent.style.top = `${event.clientY - rect.height - 10}px`;
            }
            if (rect.left < 0) {
                modalContent.style.left = '10px';
                modalContent.style.transform = 'none';
            }
        }, 0);
        
        // 显示模态框
        modal.style.display = 'flex';
        
        // 添加点击背景关闭模态框的事件监听器
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeWordModal();
            }
        };
    }

    closeWordModal() {
        const modal = document.getElementById('wordModal');
        modal.style.display = 'none';
    }

    handleWordAddToLearning(word, translation) {
        const result = this.vocabularyManager.addWord(word, translation);
        if (result) {
            this.app.showNotification(`📖 '${word}' added to learning list.`);
        }
        this.app.updateCounts();
        this.refreshTextAnalysis();
    }

    handleWordMaster(word, translation) {
        const result = this.vocabularyManager.masterWord(word, translation);
        if (result === 'added_to_mastered' || result === 'moved_to_mastered') {
            this.app.showNotification(`✅ '${word}' marked as mastered.`);
        }
        this.app.updateCounts();
        this.refreshTextAnalysis();
    }

    handleWordUnmaster(word) {
        const result = this.vocabularyManager.unmasterWord(word);
        if (result === 'moved_to_learning') {
            this.app.showNotification(`📖 '${word}' moved to learning list.`);
            this.app.updateCounts();
        }
        this.refreshTextAnalysis();
    }
    
    // 重新分析并刷新文本高亮
    refreshTextAnalysis() {
        // 获取当前显示的文本内容
        const currentText = document.getElementById('textInput').value;
        if (!currentText) return;
        
        // 重新分析文本
        const words = this.app.textAnalyzer.extractWords(currentText);
        const analysis = this.app.textAnalyzer.analyzeWords(
            words,
            this.app.settingsManager.getSetting('difficultyLevel'),
            this.app.settingsManager.getSetting('highlightMode'),
            { 
                learning: this.vocabularyManager.learningWords, 
                mastered: this.vocabularyManager.masteredWords 
            }
        );
        
        const processedText = this.app.textAnalyzer.processTextForDisplay(currentText, analysis);
        this.render(processedText);
        
        // 更新统计信息
        this.app.updateStatistics(analysis);
    }
}