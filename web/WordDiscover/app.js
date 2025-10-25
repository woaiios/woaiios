/**
 * WordDiscoverer Main Application
 * Orchestrates all modules and handles the main application logic
 */
import { WordDatabase } from './js/WordDatabase.js';
import { TextAnalyzer } from './js/TextAnalyzer.js';
import { VocabularyManager } from './js/VocabularyManager.js';
import { SettingsManager } from './js/SettingsManager.js';
import { UIController } from './js/UIController.js';

export class WordDiscoverer {
    constructor() {
        // Initialize modules
        this.wordDatabase = new WordDatabase();
        this.vocabularyManager = new VocabularyManager();
        this.settingsManager = new SettingsManager();
        this.textAnalyzer = new TextAnalyzer(this.wordDatabase, this.settingsManager);
        this.uiController = new UIController(this.vocabularyManager, this.settingsManager);
        
        // Initialize application
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Initialize UI
            this.uiController.initializeEventListeners();
            this.uiController.updateUI();
            
            // Set up analyze button handler
            this.setupAnalyzeHandler();
            
            // Initialize word database
            await this.wordDatabase.initialize();
            
            // Initialize Google Drive integration
            await this.uiController.initializeGoogleDrive();

            if (this.settingsManager.getSetting('googleDriveSync')) {
                console.log('Attempting to restore Google Drive session...');
                const success = await this.vocabularyManager.enableGoogleDriveSync(true); // silent sign-in
                if (success) {
                    console.log('Google Drive session restored.');
                    this.uiController.showNotification('Google Drive connected.', 'info');
                } else {
                    console.log('Could not restore Google Drive session silently.');
                    this.settingsManager.setSetting('googleDriveSync', false);
                }
                await this.uiController.updateGoogleDriveStatus();
            }
            
            console.log('WordDiscoverer initialized successfully');
        } catch (error) {
            console.error('Error initializing WordDiscoverer:', error);
            this.uiController.showNotification('Error initializing application. Please refresh the page.', 'error');
        }
    }

    /**
     * Set up analyze button handler
     */
    setupAnalyzeHandler() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeText());
        }
    }

    /**
     * Analyze text input
     */
    async analyzeText() {
        const textInput = document.getElementById('textInput');
        if (!textInput) return;
        
        const text = textInput.value.trim();
        if (!text) {
            this.uiController.showNotification('Please enter some text to analyze.', 'error');
            return;
        }

        // Check if word database is loaded
        if (!this.wordDatabase.isDatabaseLoaded()) {
            this.uiController.showLoading(true);
            try {
                await this.wordDatabase.initialize();
            } catch (error) {
                console.error('Failed to load word database:', error);
                this.uiController.showNotification('Failed to load word database. Please refresh the page and try again.', 'error');
                this.uiController.showLoading(false);
                return;
            }
        }

        this.uiController.showLoading(true);
        
        try {
            // Get current settings
            const difficultyLevel = this.settingsManager.getSetting('difficultyLevel');
            const highlightMode = this.settingsManager.getSetting('highlightMode');
            
            // Extract and analyze words
            const words = this.textAnalyzer.extractWords(text);
            const analysis = this.textAnalyzer.analyzeWords(
                words, 
                difficultyLevel, 
                highlightMode, 
                { learning: this.vocabularyManager.learningWords, mastered: this.vocabularyManager.masteredWords }
            );
            
            // Process text for display
            const processedText = this.textAnalyzer.processTextForDisplay(text, analysis);
            
            // Update UI
            this.uiController.displayAnalyzedText(processedText);
            
            this.uiController.updateStatistics(analysis);
            this.uiController.showAnalyzedTextSection();
            
            // Show notification for new words
            if (analysis.newWords.length > 0) {
                this.uiController.showNotification(
                    `Found ${analysis.newWords.length} new word${analysis.newWords.length > 1 ? 's' : ''} to learn!`,
                    'info'
                );
            }
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.uiController.showNotification('Error analyzing text. Please try again.', 'error');
        } finally {
            this.uiController.showLoading(false);
        }
    }

    /**
     * Add word to vocabulary
     * @param {string} word - Word to add
     * @param {string} translation - Translation
     */
    addToVocabulary(word, translation) {
        if (this.vocabularyManager.addWord(word, translation)) {
            this.uiController.updateUI();
            this.uiController.showNotification(`"${word}" added to vocabulary!`);
        } else {
            this.uiController.showNotification(`"${word}" is already in your vocabulary!`, 'info');
        }
    }

    /**
     * Get application statistics
     * @returns {Object} Application statistics
     */
    getStatistics() {
        const vocabStats = this.vocabularyManager.getStatistics();
        const dbStats = this.wordDatabase.getStatistics();
        
        return {
            vocabulary: vocabStats,
            database: dbStats,
            settings: this.settingsManager.getAllSettings()
        };
    }

    /**
     * Export all application data
     * @returns {Object} Complete application data
     */
    exportAllData() {
        return {
            vocabulary: this.vocabularyManager.exportVocabulary(),
            settings: this.settingsManager.exportSettings(),
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
    }

    /**
     * Import all application data
     * @param {Object} data - Complete application data
     * @returns {boolean} Success status
     */
    importAllData(data) {
        try {
            let success = true;
            
            if (data.vocabulary) {
                success = this.vocabularyManager.importVocabulary(data.vocabulary) && success;
            }
            
            if (data.settings) {
                success = this.settingsManager.importSettings(data.settings) && success;
            }
            
            if (success) {
                this.uiController.updateUI();
                this.uiController.showNotification('All data imported successfully!');
            }
            
            return success;
        } catch (error) {
            console.error('Error importing data:', error);
            this.uiController.showNotification('Error importing data. Please check the file format.', 'error');
            return false;
        }
    }

    /**
     * Reset application to default state
     */
    resetApplication() {
        if (confirm('Reset application to default state? This will clear all vocabulary and settings. This action cannot be undone.')) {
            this.vocabularyManager.clearVocabulary();
            this.settingsManager.resetToDefault();
            this.uiController.updateUI();
            this.uiController.showNotification('Application reset to default state.');
        }
    }

    /**
     * Get module instances (for debugging/testing)
     * @returns {Object} Module instances
     */
    getModules() {
        return {
            wordDatabase: this.wordDatabase,
            vocabularyManager: this.vocabularyManager,
            settingsManager: this.settingsManager,
            textAnalyzer: this.textAnalyzer,
            uiController: this.uiController
        };
    }
}

// Initialize the application when DOM is loaded
let wordDiscoverer;

document.addEventListener('DOMContentLoaded', () => {
    try {
        wordDiscoverer = new WordDiscoverer();
        
        // Make it globally available for debugging
        window.wordDiscoverer = wordDiscoverer;
        window.uiController = wordDiscoverer.uiController;
        
        console.log('WordDiscoverer application started');
    } catch (error) {
        console.error('Failed to initialize WordDiscoverer:', error);
    }
});
