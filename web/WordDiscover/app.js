import { WordDatabase } from './js/WordDatabase.js';
import { TextAnalyzer } from './js/TextAnalyzer.js';
import { VocabularyManager } from './js/VocabularyManager.js';
import { SettingsManager } from './js/SettingsManager.js';
import { VocabularyComponent } from './components/Vocabulary/Vocabulary.js';
import { SettingsComponent } from './components/Settings/Settings.js';
import { AnalyzedTextComponent } from './components/AnalyzedText/AnalyzedText.js';

class WordDiscoverer {
    constructor() {
        // Core Logic Modules
        this.settingsManager = new SettingsManager();
        this.wordDatabase = new WordDatabase();
        this.vocabularyManager = new VocabularyManager();
        this.textAnalyzer = new TextAnalyzer(this.wordDatabase);

        // UI Components
        this.vocabularyComponent = new VocabularyComponent(this.vocabularyManager);
        this.settingsComponent = new SettingsComponent(this.settingsManager, this.vocabularyManager.googleDriveManager);
        this.analyzedTextComponent = new AnalyzedTextComponent('#analyzedText', this.vocabularyManager);
        
        this.vocabularyComponent.setApp(this);
        this.settingsComponent.setApp(this);
        this.analyzedTextComponent.setApp(this);

        this.initialize();
    }

    async initialize() {
        this.addEventListeners();
        this.updateCounts();
        await this.wordDatabase.initialize();
        console.log('WordDiscoverer initialized successfully');
    }

    addEventListeners() {
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeText());
        document.getElementById('vocabularyBtn').addEventListener('click', () => this.vocabularyComponent.open());
        document.getElementById('settingsBtn').addEventListener('click', () => this.settingsComponent.open());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearText());
        
        // 添加单词模态框关闭按钮事件监听器
        const wordModalClose = document.getElementById('wordModalClose');
        if (wordModalClose) {
            wordModalClose.addEventListener('click', () => {
                document.getElementById('wordModal').classList.remove('show');
            });
        }
        
        // Synchronize difficulty level between main page and settings
        const mainDifficultyLevel = document.getElementById('mainDifficultyLevel');
        if (mainDifficultyLevel) {
            mainDifficultyLevel.addEventListener('change', (e) => {
                this.settingsManager.setSetting('difficultyLevel', e.target.value);
                this.refreshTextAnalysis(); // 添加这行
            });
        }
        
        // Synchronize highlight mode between main page and settings
        const mainHighlightMode = document.getElementById('mainHighlightMode');
        if (mainHighlightMode) {
            mainHighlightMode.addEventListener('change', (e) => {
                this.settingsManager.setSetting('highlightMode', e.target.value);
                this.refreshTextAnalysis(); // 添加这行
            });
        }
    }

    async analyzeText() {
        const text = document.getElementById('textInput').value.trim();
        if (!text) {
            this.showNotification('Please enter some text to analyze.', 'error');
            return;
        }

        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.classList.add('show');

        try {
            const words = this.textAnalyzer.extractWords(text);
            const analysis = this.textAnalyzer.analyzeWords(
                words,
                this.settingsManager.getSetting('difficultyLevel'),
                this.settingsManager.getSetting('highlightMode'),
                { learning: this.vocabularyManager.learningWords, mastered: this.vocabularyManager.masteredWords }
            );

            const processedText = this.textAnalyzer.processTextForDisplay(text, analysis);
            this.analyzedTextComponent.render(processedText);
            
            document.getElementById('analyzedTextSection').style.display = 'block';
            document.getElementById('statistics').style.display = 'flex';
            document.getElementById('highlightedWordsList').style.display = 'block';
            this.updateStatistics(analysis);
            this.displayHighlightedWords(analysis.highlightedWords);

        } catch (error) {
            console.error('Analysis error:', error);
            this.showNotification('Error analyzing text. Please try again.', 'error');
        } finally {
            loadingOverlay.classList.remove('show');
        }
    }
    
    // 添加这个新方法来刷新文本分析
    refreshTextAnalysis() {
        // 只有在已经有分析过的文本时才刷新
        if (document.getElementById('analyzedTextSection').style.display !== 'block') return;
        
        const text = document.getElementById('textInput').value.trim();
        if (!text) return;

        const words = this.textAnalyzer.extractWords(text);
        const analysis = this.textAnalyzer.analyzeWords(
            words,
            this.settingsManager.getSetting('difficultyLevel'),
            this.settingsManager.getSetting('highlightMode'),
            { learning: this.vocabularyManager.learningWords, mastered: this.vocabularyManager.masteredWords }
        );

        const processedText = this.textAnalyzer.processTextForDisplay(text, analysis);
        this.analyzedTextComponent.render(processedText);
        this.updateStatistics(analysis);
        this.displayHighlightedWords(analysis.highlightedWords);
    }
    
    updateStatistics(analysis) {
        document.getElementById('totalWords').textContent = analysis.totalWords;
        document.getElementById('highlightedWords').textContent = analysis.highlightedWords.length;
        document.getElementById('newWords').textContent = analysis.newWords.length;
        document.getElementById('difficultyScore').textContent = analysis.difficultyScore;
    }

    displayHighlightedWords(highlightedWords) {
        const container = document.getElementById('highlightedWordsContainer');
        container.innerHTML = '';

        if (highlightedWords.length === 0) {
            container.innerHTML = '<p>No highlighted words found.</p>';
            return;
        }

        highlightedWords.forEach(wordInfo => {
            const wordItem = document.createElement('div');
            wordItem.className = 'highlighted-word-item';
            
            // Parse the HTML translation to extract pronunciation and meaning
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = wordInfo.translation;
            
            // Extract pronunciation and translation
            let pronunciation = '';
            let translation = '';
            
            const pronElement = tempDiv.querySelector('.pron');
            if (pronElement) {
                pronunciation = pronElement.textContent.trim();
            }
            
            const transElement = tempDiv.querySelector('.trans');
            if (transElement) {
                translation = transElement.textContent.trim();
            }
            
            // If we couldn't parse the structured translation, use the raw HTML
            if (!pronElement && !transElement) {
                translation = wordInfo.translation;
            }
            
            wordItem.innerHTML = `
                <div class="word">${wordInfo.word}</div>
                ${pronunciation ? `<div class="pronunciation">/${pronunciation}/</div>` : ''}
                <div class="translation">${translation}</div>
            `;
            
            container.appendChild(wordItem);
        });
    }

    updateCounts() {
        this.vocabularyComponent.updateCounts();
    }

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
        setTimeout(() => notification.remove(), 3000);
    }

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
    
    clearText() {
        const textInput = document.getElementById('textInput');
        textInput.value = '';
        
        // Hide analysis results
        document.getElementById('analyzedTextSection').style.display = 'none';
        document.getElementById('statistics').style.display = 'none';
        document.getElementById('highlightedWordsList').style.display = 'none';
        
        // Clear analyzed text display
        document.getElementById('analyzedText').innerHTML = '';
        
        // Reset statistics
        document.getElementById('totalWords').textContent = '0';
        document.getElementById('highlightedWords').textContent = '0';
        document.getElementById('newWords').textContent = '0';
        document.getElementById('difficultyScore').textContent = '0';
        
        // Clear highlighted words list
        document.getElementById('highlightedWordsContainer').innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.wordDiscoverer = new WordDiscoverer();
});