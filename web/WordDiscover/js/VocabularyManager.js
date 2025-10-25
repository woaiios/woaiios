/**
 * VocabularyManager Module
 * Handles vocabulary management and persistence
 */
import { GoogleDriveManager } from './GoogleDriveManager.js';

export class VocabularyManager {
    constructor() {
        this.vocabulary = this.loadVocabulary();
        this.googleDriveManager = new GoogleDriveManager();
        this.syncEnabled = false;
        this.lastSyncTime = null;
    }

    /**
     * Add word to vocabulary
     * @param {string} word - Word to add
     * @param {string} translation - Translation of the word
     * @returns {boolean} Success status
     */
    addWord(word, translation) {
        if (!this.vocabulary.has(word)) {
            this.vocabulary.set(word, {
                translation: translation,
                addedDate: new Date().toISOString(),
                reviewCount: 0,
                lastReviewed: null
            });
            this.saveVocabulary();
            return true;
        }
        return false;
    }

    /**
     * Remove word from vocabulary
     * @param {string} word - Word to remove
     * @returns {boolean} Success status
     */
    removeWord(word) {
        if (this.vocabulary.has(word)) {
            this.vocabulary.delete(word);
            this.saveVocabulary();
            return true;
        }
        return false;
    }

    /**
     * Check if word exists in vocabulary
     * @param {string} word - Word to check
     * @returns {boolean} Exists status
     */
    hasWord(word) {
        return this.vocabulary.has(word);
    }

    /**
     * Get word data from vocabulary
     * @param {string} word - Word to get
     * @returns {Object|null} Word data or null
     */
    getWordData(word) {
        return this.vocabulary.get(word) || null;
    }

    /**
     * Get all vocabulary entries
     * @returns {Array} Array of [word, data] pairs
     */
    getAllWords() {
        return Array.from(this.vocabulary.entries());
    }

    /**
     * Get vocabulary size
     * @returns {number} Number of words
     */
    getSize() {
        return this.vocabulary.size;
    }

    /**
     * Clear all vocabulary
     * @returns {boolean} Success status
     */
    clearVocabulary() {
        this.vocabulary.clear();
        this.saveVocabulary();
        return true;
    }

    /**
     * Get vocabulary sorted by date added (newest first)
     * @returns {Array} Sorted vocabulary entries
     */
    getSortedByDate() {
        return Array.from(this.vocabulary.entries()).sort((a, b) => 
            new Date(b[1].addedDate) - new Date(a[1].addedDate)
        );
    }

    /**
     * Get vocabulary sorted by review count (least reviewed first)
     * @returns {Array} Sorted vocabulary entries
     */
    getSortedByReviewCount() {
        return Array.from(this.vocabulary.entries()).sort((a, b) => 
            a[1].reviewCount - b[1].reviewCount
        );
    }

    /**
     * Update word review count
     * @param {string} word - Word to update
     * @returns {boolean} Success status
     */
    updateReviewCount(word) {
        const wordData = this.vocabulary.get(word);
        if (wordData) {
            wordData.reviewCount++;
            wordData.lastReviewed = new Date().toISOString();
            this.saveVocabulary();
            return true;
        }
        return false;
    }

    /**
     * Export vocabulary to JSON
     * @returns {Object} Export data
     */
    exportVocabulary() {
        return {
            vocabulary: Array.from(this.vocabulary.entries()),
            exportDate: new Date().toISOString(),
            version: '1.0',
            totalWords: this.vocabulary.size
        };
    }

    /**
     * Import vocabulary from JSON data
     * @param {Object} data - Import data
     * @returns {boolean} Success status
     */
    importVocabulary(data) {
        try {
            if (data.vocabulary && Array.isArray(data.vocabulary)) {
                this.vocabulary = new Map(data.vocabulary);
                this.saveVocabulary();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error importing vocabulary:', error);
            return false;
        }
    }

    /**
     * Get vocabulary statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        const words = Array.from(this.vocabulary.values());
        const totalReviews = words.reduce((sum, word) => sum + word.reviewCount, 0);
        const reviewedWords = words.filter(word => word.reviewCount > 0).length;
        
        return {
            totalWords: this.vocabulary.size,
            totalReviews: totalReviews,
            reviewedWords: reviewedWords,
            unreviewedWords: this.vocabulary.size - reviewedWords,
            averageReviewsPerWord: this.vocabulary.size > 0 ? Math.round(totalReviews / this.vocabulary.size * 10) / 10 : 0
        };
    }

    /**
     * Load vocabulary from localStorage
     * @returns {Map} Vocabulary map
     */
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

    /**
     * Save vocabulary to localStorage
     */
    saveVocabulary() {
        localStorage.setItem('wordDiscovererVocabulary', JSON.stringify(Array.from(this.vocabulary.entries())));
        
        // Auto-sync to Google Drive if enabled
        if (this.syncEnabled) {
            this.syncToGoogleDrive();
        }
    }

    /**
     * Initialize Google Drive integration
     * @returns {Promise<boolean>} Success status
     */
    async initializeGoogleDrive() {
        try {
            const success = await this.googleDriveManager.initialize();
            if (success) {
                console.log('Google Drive integration initialized');
            }
            return success;
        } catch (error) {
            console.error('Error initializing Google Drive:', error);
            return false;
        }
    }

    /**
     * Enable Google Drive sync
     * @returns {Promise<boolean>} Success status
     */
    async enableGoogleDriveSync() {
        try {
            if (!this.googleDriveManager.isInitialized) {
                await this.initializeGoogleDrive();
            }

            const signInSuccess = await this.googleDriveManager.signIn();
            if (signInSuccess) {
                this.syncEnabled = true;
                
                // Perform initial sync
                await this.syncToGoogleDrive();
                
                console.log('Google Drive sync enabled');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error enabling Google Drive sync:', error);
            return false;
        }
    }

    /**
     * Disable Google Drive sync
     * @returns {Promise<boolean>} Success status
     */
    async disableGoogleDriveSync() {
        try {
            this.syncEnabled = false;
            await this.googleDriveManager.signOut();
            console.log('Google Drive sync disabled');
            return true;
        } catch (error) {
            console.error('Error disabling Google Drive sync:', error);
            return false;
        }
    }

    /**
     * Sync vocabulary to Google Drive
     * @returns {Promise<boolean>} Success status
     */
    async syncToGoogleDrive() {
        try {
            if (!this.syncEnabled || !this.googleDriveManager.isSignedIn) {
                return false;
            }

            const vocabularyData = this.exportVocabulary();
            const syncResult = await this.googleDriveManager.syncVocabulary(vocabularyData);
            
            if (syncResult.success) {
                if (syncResult.action === 'download') {
                    // Remote data is newer, update local vocabulary
                    this.importVocabulary(syncResult.data);
                    console.log('Vocabulary synced from Google Drive');
                } else if (syncResult.action === 'upload') {
                    console.log('Vocabulary synced to Google Drive');
                }
                
                this.lastSyncTime = new Date().toISOString();
                return true;
            } else {
                console.error('Sync failed:', syncResult.error);
                return false;
            }
        } catch (error) {
            console.error('Error syncing to Google Drive:', error);
            return false;
        }
    }

    /**
     * Force sync from Google Drive
     * @returns {Promise<boolean>} Success status
     */
    async forceSyncFromGoogleDrive() {
        try {
            if (!this.googleDriveManager.isSignedIn) {
                return false;
            }

            const remoteData = await this.googleDriveManager.downloadVocabulary();
            if (remoteData) {
                this.importVocabulary(remoteData);
                this.lastSyncTime = new Date().toISOString();
                console.log('Vocabulary force synced from Google Drive');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error force syncing from Google Drive:', error);
            return false;
        }
    }

    /**
     * Get Google Drive sync status
     * @returns {Promise<Object>} Sync status
     */
    async getGoogleDriveStatus() {
        const authStatus = this.googleDriveManager.getAuthStatus();
        const userInfo = await this.googleDriveManager.getUserInfo();
        
        return {
            syncEnabled: this.syncEnabled,
            isSignedIn: authStatus.isSignedIn,
            hasFile: authStatus.hasFile,
            lastSyncTime: this.lastSyncTime,
            userInfo: userInfo
        };
    }

    /**
     * Get Google Drive manager instance
     * @returns {GoogleDriveManager} Google Drive manager
     */
    getGoogleDriveManager() {
        return this.googleDriveManager;
    }
}
