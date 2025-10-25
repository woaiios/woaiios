// Word Discoverer - Main JavaScript File
class WordDiscoverer {
    constructor() {
        this.vocabulary = this.loadVocabulary();
        this.settings = this.loadSettings();
        this.wordDatabase = null; // Will be initialized asynchronously
        this.currentHighlightedWords = new Set();
        
        this.initializeEventListeners();
        this.updateUI();
        this.initializeWordDatabase().then(database => {
            this.wordDatabase = database;
            console.log('Word database initialized');
        });
    }

    // Initialize word database with difficulty levels
    async initializeWordDatabase() {
        try {
            console.log('Loading dictionary from eng_dict.txt...');
            const response = await fetch('./eng_dict.txt');
            if (!response.ok) {
                throw new Error(`Failed to load dictionary: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log(`Dictionary file loaded, size: ${text.length} characters`);
            const lines = text.split('\n');
            console.log(`Total lines in dictionary: ${lines.length}`);
            
            const wordDatabase = {
                common: new Set(),
                beginner: new Set(),
                intermediate: new Set(),
                advanced: new Set(),
                expert: new Set()
            };
            
            // Parse each line and categorize words by difficulty level
            lines.forEach((line, index) => {
                if (line.trim()) {
                    // Split by tabs to get all word forms
                    const words = line.split('\t').map(word => word.trim().toLowerCase()).filter(word => word);
                    
                    // Determine difficulty level based on line number
                    let difficulty;
                    if (index < 1000) {
                        difficulty = 'common';
                    } else if (index < 3000) {
                        difficulty = 'beginner';
                    } else if (index < 5000) {
                        difficulty = 'intermediate';
                    } else if (index < 8000) {
                        difficulty = 'advanced';
                    } else {
                        difficulty = 'expert';
                    }
                    
                    // Add all word forms to the appropriate difficulty set
                    words.forEach(word => {
                        wordDatabase[difficulty].add(word);
                    });
                }
            });
            
            console.log('Dictionary loaded successfully:', {
                common: wordDatabase.common.size,
                beginner: wordDatabase.beginner.size,
                intermediate: wordDatabase.intermediate.size,
                advanced: wordDatabase.advanced.size,
                expert: wordDatabase.expert.size
            });
            
            return wordDatabase;
            
        } catch (error) {
            console.error('Error loading dictionary:', error);
            // Fallback to empty sets if dictionary loading fails
            return {
                common: new Set(),
                beginner: new Set(),
                intermediate: new Set(),
                advanced: new Set(),
                expert: new Set()
            };
        }
    }

    // Event Listeners
    initializeEventListeners() {
        // Main buttons
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeText());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearText());
        
        // Modal controls
        document.getElementById('vocabularyBtn').addEventListener('click', () => this.openVocabularyModal());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('closeVocabModal').addEventListener('click', () => this.closeModal('vocabularyModal'));
        document.getElementById('closeSettingsModal').addEventListener('click', () => this.closeModal('settingsModal'));
        
        // Vocabulary controls
        document.getElementById('exportVocabBtn').addEventListener('click', () => this.exportVocabulary());
        document.getElementById('importVocabBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importVocabulary(e));
        document.getElementById('clearVocabBtn').addEventListener('click', () => this.clearVocabulary());
        
        // Settings controls
        document.getElementById('exportSettingsBtn').addEventListener('click', () => this.exportSettings());
        document.getElementById('importSettingsBtn').addEventListener('click', () => document.getElementById('importSettingsFile').click());
        document.getElementById('importSettingsFile').addEventListener('change', (e) => this.importSettings(e));
        
        // Settings updates
        document.getElementById('highlightOpacity').addEventListener('input', (e) => {
            document.getElementById('opacityValue').textContent = Math.round(e.target.value * 100) + '%';
            this.settings.highlightOpacity = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('highlightColor').addEventListener('change', (e) => {
            this.settings.highlightColor = e.target.value;
            this.saveSettings();
        });
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // Text Analysis
    async analyzeText() {
        const text = document.getElementById('textInput').value.trim();
        if (!text) {
            alert('Please enter some text to analyze.');
            return;
        }

        // Wait for word database to be loaded
        if (!this.wordDatabase) {
            this.showLoading(true);
            try {
                this.wordDatabase = await this.initializeWordDatabase();
            } catch (error) {
                console.error('Failed to load word database:', error);
                alert('Failed to load word database. Please refresh the page and try again.');
                this.showLoading(false);
                return;
            }
        }

        this.showLoading(true);
        
        try {
            const words = this.extractWords(text);
            const difficultyLevel = document.getElementById('difficultyLevel').value;
            const highlightMode = document.getElementById('highlightMode').value;
            
            const analysis = this.analyzeWords(words, difficultyLevel, highlightMode);
            this.displayAnalyzedText(text, analysis);
            this.updateStatistics(analysis);
            
            document.getElementById('analyzedTextSection').style.display = 'block';
            document.getElementById('statistics').style.display = 'flex';
            
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Error analyzing text. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    extractWords(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    analyzeWords(words, difficultyLevel, highlightMode) {
        const analysis = {
            totalWords: words.length,
            highlightedWords: [],
            newWords: [],
            difficultyScore: 0,
            wordFrequency: {}
        };

        // Count word frequency
        words.forEach(word => {
            analysis.wordFrequency[word] = (analysis.wordFrequency[word] || 0) + 1;
        });

        // Analyze each unique word
        const uniqueWords = [...new Set(words)];
        uniqueWords.forEach(word => {
            const difficulty = this.getWordDifficulty(word, difficultyLevel);
            const isHighlighted = this.shouldHighlight(word, difficulty, highlightMode);
            
            if (isHighlighted) {
                analysis.highlightedWords.push({
                    word: word,
                    difficulty: difficulty,
                    frequency: analysis.wordFrequency[word],
                    translation: this.getTranslation(word)
                });
                
                if (!this.vocabulary.has(word)) {
                    analysis.newWords.push(word);
                }
            }
            
            analysis.difficultyScore += difficulty.score;
        });

        analysis.difficultyScore = Math.round(analysis.difficultyScore / uniqueWords.length);
        
        return analysis;
    }

    getWordDifficulty(word, difficultyLevel) {
        const levels = ['common', 'beginner', 'intermediate', 'advanced'];
        const levelIndex = levels.indexOf(difficultyLevel);
        
        for (let i = 0; i <= levelIndex; i++) {
            if (this.wordDatabase[levels[i]].has(word)) {
                return {
                    level: levels[i],
                    score: i * 25,
                    className: levels[i]
                };
            }
        }
        
        return {
            level: 'expert',
            score: 100,
            className: 'unknown'
        };
    }

    shouldHighlight(word, difficulty, highlightMode) {
        switch (highlightMode) {
            case 'unknown':
                return difficulty.level === 'expert' || difficulty.level === 'advanced';
            case 'difficult':
                return difficulty.level === 'expert' || difficulty.level === 'advanced' || difficulty.level === 'intermediate';
            case 'all':
                return true;
            default:
                return false;
        }
    }

    getTranslation(word) {
        // Mock translation - in a real app, you'd call a translation API
        const translations = {
            'hello': '你好',
            'world': '世界',
            'beautiful': '美丽的',
            'amazing': '令人惊叹的',
            'wonderful': '精彩的',
            'fantastic': '极好的',
            'excellent': '优秀的',
            'outstanding': '杰出的',
            'remarkable': '非凡的',
            'extraordinary': '非凡的'
        };
        
        return translations[word] || 'Translation not available';
    }

    displayAnalyzedText(originalText, analysis) {
        const analyzedTextDiv = document.getElementById('analyzedText');
        let processedText = originalText;
        
        // Create a map of highlighted words for quick lookup
        const highlightedMap = {};
        analysis.highlightedWords.forEach(item => {
            highlightedMap[item.word] = item;
        });
        
        // Replace words with highlighted versions
        const words = this.extractWords(originalText);
        const uniqueWords = [...new Set(words)];
        
        uniqueWords.forEach(word => {
            if (highlightedMap[word]) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                processedText = processedText.replace(regex, `<span class="highlighted-word ${highlightedMap[word].difficulty.className}" data-word="${word}" data-translation="${highlightedMap[word].translation}">${word}</span>`);
            }
        });
        
        analyzedTextDiv.innerHTML = processedText;
        
        // Add hover events for highlighted words
        analyzedTextDiv.querySelectorAll('.highlighted-word').forEach(element => {
            element.addEventListener('mouseenter', (e) => this.showTooltip(e));
            element.addEventListener('mouseleave', () => this.hideTooltip());
            element.addEventListener('click', (e) => this.addToVocabulary(e.target.dataset.word, e.target.dataset.translation));
        });
    }

    updateStatistics(analysis) {
        document.getElementById('totalWords').textContent = analysis.totalWords;
        document.getElementById('highlightedWords').textContent = analysis.highlightedWords.length;
        document.getElementById('newWords').textContent = analysis.newWords.length;
        document.getElementById('difficultyScore').textContent = analysis.difficultyScore;
        document.getElementById('vocabCount').textContent = this.vocabulary.size;
    }

    // Tooltip functionality
    showTooltip(event) {
        const word = event.target.dataset.word;
        const translation = event.target.dataset.translation;
        
        const tooltip = document.getElementById('translationTooltip');
        document.getElementById('tooltipWord').textContent = word;
        document.getElementById('tooltipTranslation').textContent = translation;
        
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 5) + 'px';
        tooltip.classList.add('show');
        
        // Update add to vocab button
        document.getElementById('addToVocabBtn').onclick = () => {
            this.addToVocabulary(word, translation);
            this.hideTooltip();
        };
    }

    hideTooltip() {
        document.getElementById('translationTooltip').classList.remove('show');
    }

    // Vocabulary management
    addToVocabulary(word, translation) {
        if (!this.vocabulary.has(word)) {
            this.vocabulary.set(word, {
                translation: translation,
                addedDate: new Date().toISOString(),
                reviewCount: 0
            });
            this.saveVocabulary();
            this.updateUI();
            this.showNotification(`"${word}" added to vocabulary!`);
        } else {
            this.showNotification(`"${word}" is already in your vocabulary!`);
        }
    }

    openVocabularyModal() {
        this.displayVocabularyList();
        document.getElementById('vocabularyModal').classList.add('show');
    }

    displayVocabularyList() {
        const vocabList = document.getElementById('vocabList');
        vocabList.innerHTML = '';
        
        if (this.vocabulary.size === 0) {
            vocabList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">No words in vocabulary yet.</p>';
            return;
        }
        
        const sortedVocab = Array.from(this.vocabulary.entries()).sort((a, b) => 
            new Date(b[1].addedDate) - new Date(a[1].addedDate)
        );
        
        sortedVocab.forEach(([word, data]) => {
            const vocabItem = document.createElement('div');
            vocabItem.className = 'vocab-item';
            vocabItem.innerHTML = `
                <div>
                    <div class="vocab-word">${word}</div>
                    <div class="vocab-translation">${data.translation}</div>
                </div>
                <div class="vocab-actions">
                    <button class="btn btn-sm btn-danger" onclick="wordDiscoverer.removeFromVocabulary('${word}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            vocabList.appendChild(vocabItem);
        });
    }

    removeFromVocabulary(word) {
        if (confirm(`Remove "${word}" from vocabulary?`)) {
            this.vocabulary.delete(word);
            this.saveVocabulary();
            this.displayVocabularyList();
            this.updateUI();
            this.showNotification(`"${word}" removed from vocabulary.`);
        }
    }

    clearVocabulary() {
        if (confirm('Clear all vocabulary? This action cannot be undone.')) {
            this.vocabulary.clear();
            this.saveVocabulary();
            this.displayVocabularyList();
            this.updateUI();
            this.showNotification('Vocabulary cleared.');
        }
    }

    exportVocabulary() {
        const data = {
            vocabulary: Array.from(this.vocabulary.entries()),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        this.downloadJSON(data, 'vocabulary.json');
        this.showNotification('Vocabulary exported successfully!');
    }

    importVocabulary(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.vocabulary) {
                    this.vocabulary = new Map(data.vocabulary);
                    this.saveVocabulary();
                    this.displayVocabularyList();
                    this.updateUI();
                    this.showNotification('Vocabulary imported successfully!');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                alert('Error importing vocabulary. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    // Settings management
    openSettingsModal() {
        this.loadSettingsToUI();
        document.getElementById('settingsModal').classList.add('show');
    }

    loadSettingsToUI() {
        document.getElementById('highlightColor').value = this.settings.highlightColor;
        document.getElementById('highlightOpacity').value = this.settings.highlightOpacity;
        document.getElementById('opacityValue').textContent = Math.round(this.settings.highlightOpacity * 100) + '%';
        document.getElementById('translationService').value = this.settings.translationService;
        document.getElementById('targetLanguage').value = this.settings.targetLanguage;
    }

    exportSettings() {
        const data = {
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        this.downloadJSON(data, 'settings.json');
        this.showNotification('Settings exported successfully!');
    }

    importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.settings) {
                    this.settings = { ...this.settings, ...data.settings };
                    this.saveSettings();
                    this.loadSettingsToUI();
                    this.showNotification('Settings imported successfully!');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                alert('Error importing settings. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    // Utility functions
    clearText() {
        document.getElementById('textInput').value = '';
        document.getElementById('analyzedTextSection').style.display = 'none';
        document.getElementById('statistics').style.display = 'none';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showNotification(message) {
        // Simple notification - could be enhanced with a proper notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 3000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
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

    updateUI() {
        document.getElementById('vocabCount').textContent = this.vocabulary.size;
    }

    // Data persistence
    loadVocabulary() {
        const saved = localStorage.getItem('wordDiscovererVocabulary');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                return new Map(data);
            } catch (error) {
                console.error('Error loading vocabulary:', error);
            }
        }
        return new Map();
    }

    saveVocabulary() {
        localStorage.setItem('wordDiscovererVocabulary', JSON.stringify(Array.from(this.vocabulary.entries())));
    }

    loadSettings() {
        const defaultSettings = {
            highlightColor: '#ffeb3b',
            highlightOpacity: 0.7,
            translationService: 'bing',
            targetLanguage: 'zh'
        };
        
        const saved = localStorage.getItem('wordDiscovererSettings');
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
        return defaultSettings;
    }

    saveSettings() {
        localStorage.setItem('wordDiscovererSettings', JSON.stringify(this.settings));
    }
}

// Initialize the application
let wordDiscoverer;
document.addEventListener('DOMContentLoaded', () => {
    wordDiscoverer = new WordDiscoverer();
});
