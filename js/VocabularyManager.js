/**
 * VocabularyManager Module
 * Handles vocabulary management and persistence with separate lists for learning and mastered words.
 */
import { GoogleDriveManager } from './GoogleDriveManager.js';

export class VocabularyManager {
    constructor() {
        const { learningWords, masteredWords } = this.loadVocabulary();
        this.learningWords = learningWords;
        this.masteredWords = masteredWords;
        
        this.googleDriveManager = new GoogleDriveManager();
        this.syncEnabled = false;
        this.lastSyncTime = null;
        this.isSyncing = false;
    }

    /**
     * Add a new word to the learning list.
     * @param {string} word - Word to add.
     * @param {string} translation - Translation of the word.
     * @returns {boolean} True if the word was added, false if it already exists.
     */
    addWord(word, translation) {
        if (this.isKnownWord(word)) {
            return false;
        }
        
        this.learningWords.set(word, {
            translation: translation,
            addedDate: new Date().toISOString(),
            reviewCount: 0,
            lastReviewed: null
        });
        
        this.saveVocabulary();
        return true;
    }

    /**
     * Move a word from the learning list to the mastered list.
     * @param {string} word - The word to master.
     * @returns {boolean} True if the word was moved, false otherwise.
     */
    masterWord(word, translation) {
        const lowerCaseWord = word.toLowerCase();
        if (this.masteredWords.has(lowerCaseWord)) {
            return 'already_mastered';
        }

        let wordData;
        if (this.learningWords.has(lowerCaseWord)) {
            wordData = this.learningWords.get(lowerCaseWord);
            this.learningWords.delete(lowerCaseWord);
            this.masteredWords.set(lowerCaseWord, wordData);
            this.saveVocabulary();
            return 'moved_to_mastered';
        }

        // Add new word directly to mastered list
        wordData = {
            translation: translation,
            addedDate: new Date().toISOString(),
            reviewCount: 0, // New mastered words start with 0 reviews
            lastReviewed: null
        };
        this.masteredWords.set(lowerCaseWord, wordData);
        this.saveVocabulary();
        return 'added_to_mastered';
    }

    /**
     * Move a word from the mastered list back to the learning list.
     * @param {string} word - The word to un-master.
     * @returns {string|boolean} 'moved_to_learning' on success, false otherwise.
     */
    unmasterWord(word) {
        const lowerCaseWord = word.toLowerCase();
        if (this.masteredWords.has(lowerCaseWord)) {
            const wordData = this.masteredWords.get(lowerCaseWord);
            this.masteredWords.delete(lowerCaseWord);
            this.learningWords.set(lowerCaseWord, wordData);
            this.saveVocabulary();
            return 'moved_to_learning';
        }
        return false;
    }

    /**
     * Remove a word from all vocabulary lists.
     * @param {string} word - Word to remove.
     * @returns {boolean} True if the word was removed, false if not found.
     */
    removeWord(word) {
        if (this.learningWords.has(word)) {
            this.learningWords.delete(word);
            this.saveVocabulary();
            return true;
        }
        if (this.masteredWords.has(word)) {
            this.masteredWords.delete(word);
            this.saveVocabulary();
            return true;
        }
        return false;
    }

    /**
     * Check if a word exists in either the learning or mastered list.
     * @param {string} word - Word to check.
     * @returns {boolean} True if the word is known.
     */
    isKnownWord(word) {
        return this.learningWords.has(word) || this.masteredWords.has(word);
    }

    /**
     * Check if a word is in the mastered list.
     * @param {string} word - Word to check.
     * @returns {boolean} True if the word is mastered.
     */
    isMasteredWord(word) {
        return this.masteredWords.has(word);
    }

    /**
     * Get data for a specific word from any list.
     * @param {string} word - Word to get data for.
     * @returns {Object|null} Word data or null if not found.
     */
    getWordData(word) {
        return this.learningWords.get(word) || this.masteredWords.get(word) || null;
    }

    /**
     * Get all words from the learning list.
     * @returns {Array} Array of [word, data] pairs.
     */
    getLearningWords() {
        return Array.from(this.learningWords.entries());
    }

    /**
     * Get all words from the mastered list.
     * @returns {Array} Array of [word, data] pairs.
     */
    getMasteredWords() {
        return Array.from(this.masteredWords.entries());
    }

    /**
     * Get the number of words in the learning list.
     * @returns {number} Number of words.
     */
    getLearningSize() {
        return this.learningWords.size;
    }

    /**
     * Get the total number of words in all lists.
     * @returns {number} Total number of words.
     */
    getTotalSize() {
        return this.learningWords.size + this.masteredWords.size;
    }

    /**
     * Clear all words from all vocabulary lists.
     */
    clearVocabulary() {
        this.learningWords.clear();
        this.masteredWords.clear();
        this.saveVocabulary();
        return true;
    }

    /**
     * Get vocabulary sorted by date added (newest first).
     * @param {Map} wordList - The word list to sort.
     * @returns {Array} Sorted vocabulary entries.
     */
    getSortedByDate(wordList) {
        return Array.from(wordList.entries()).sort((a, b) => 
            new Date(b[1].addedDate) - new Date(a[1].addedDate)
        );
    }

    /**
     * Update the review count for a word in the learning list.
     * @param {string} word - Word to update.
     * @returns {boolean} True if updated, false otherwise.
     */
    updateReviewCount(word) {
        const wordData = this.learningWords.get(word);
        if (wordData) {
            wordData.reviewCount++;
            wordData.lastReviewed = new Date().toISOString();
            this.saveVocabulary();
            return true;
        }
        return false;
    }

    /**
     * Export all vocabulary data to a JSON-compatible object.
     * @returns {Object} Export data.
     */
    exportVocabulary() {
        return {
            version: '2.0',
            exportDate: new Date().toISOString(),
            learningWords: Array.from(this.learningWords.entries()),
            masteredWords: Array.from(this.masteredWords.entries()),
        };
    }

    /**
     * Import vocabulary from a JSON object. Handles both old and new data formats.
     * @param {Object} data - Import data.
     * @returns {boolean} True on success, false on failure.
     */
    importVocabulary(data) {
        try {
            // Handle new format (v2.0)
            if (data.version === '2.0' && data.learningWords) {
                this.learningWords = new Map(data.learningWords || []);
                this.masteredWords = new Map(data.masteredWords || []);
            } 
            // Handle old format (v1.0)
            else if (data.vocabulary && Array.isArray(data.vocabulary)) {
                // Migrate old data to the new 'learningWords' list
                this.learningWords = new Map(data.vocabulary);
                this.masteredWords = new Map();
            } else {
                return false;
            }
            
            this.saveVocabulary();
            return true;
        } catch (error) {
            console.error('Error importing vocabulary:', error);
            return false;
        }
    }

    /**
     * Get combined statistics for all vocabulary lists.
     * @returns {Object} Statistics object.
     */
    getStatistics() {
        const learning = Array.from(this.learningWords.values());
        const mastered = Array.from(this.masteredWords.values());
        const allWords = [...learning, ...mastered];
        
        const totalReviews = allWords.reduce((sum, word) => sum + word.reviewCount, 0);
        
        return {
            learningWords: this.learningWords.size,
            masteredWords: this.masteredWords.size,
            totalWords: this.getTotalSize(),
            totalReviews: totalReviews,
        };
    }

    /**
     * Load vocabulary from localStorage. Handles migration from old format.
     * @returns {{learningWords: Map, masteredWords: Map}}
     */
    loadVocabulary() {
        const saved = localStorage.getItem('wordDiscovererVocabulary');
        if (!saved) {
            return { learningWords: new Map(), masteredWords: new Map() };
        }

        try {
            const data = JSON.parse(saved);
            
            // Check for new format (v2.0)
            if (data.version === '2.0') {
                return {
                    learningWords: new Map(data.learningWords || []),
                    masteredWords: new Map(data.masteredWords || [])
                };
            }
            
            // Check for old format (Array of entries) and migrate
            if (Array.isArray(data)) {
                console.log('Migrating old vocabulary format to new v2.0 format.');
                return {
                    learningWords: new Map(data),
                    masteredWords: new Map()
                };
            }

        } catch (error) {
            console.error('Error loading vocabulary:', error);
        }

        return { learningWords: new Map(), masteredWords: new Map() };
    }

    /**
     * Save both vocabulary lists to localStorage.
     */
    saveVocabulary() {
        const dataToSave = {
            version: '2.0',
            learningWords: Array.from(this.learningWords.entries()),
            masteredWords: Array.from(this.masteredWords.entries())
        };
        localStorage.setItem('wordDiscovererVocabulary', JSON.stringify(dataToSave));
        
        if (this.syncEnabled && !this.isSyncing) {
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
    async enableGoogleDriveSync(silent = false) {
        try {
            if (!this.googleDriveManager.isInitialized) {
                await this.initializeGoogleDrive();
            }

            const signInSuccess = await this.googleDriveManager.signIn(silent);
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
        if (!this.syncEnabled || !this.googleDriveManager.isSignedIn || this.isSyncing) {
            return false;
        }

        this.isSyncing = true;
        try {
            const vocabularyData = this.exportVocabulary();
            const syncResult = await this.googleDriveManager.syncVocabulary(vocabularyData);
            
            if (syncResult.success) {
                if (syncResult.action === 'merge') {
                    // Merged data is available, update local vocabulary
                    this.importVocabulary(syncResult.data);
                    console.log('Vocabulary merged and synced with Google Drive');
                    // 在这里添加文本分析刷新调用
                    if (window.wordDiscoverer) {
                        window.wordDiscoverer.refreshTextAnalysis();
                    }
                } else if (syncResult.action === 'download') {
                    // This case is for compatibility if sync logic changes back.
                    this.importVocabulary(syncResult.data);
                    console.log('Vocabulary synced from Google Drive');
                    // 在这里添加文本分析刷新调用
                    if (window.wordDiscoverer) {
                        window.wordDiscoverer.refreshTextAnalysis();
                    }
                } else if (syncResult.action === 'upload') {
                    console.log('Vocabulary uploaded to Google Drive');
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
        } finally {
            this.isSyncing = false;
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
                // 在这里添加文本分析刷新调用
                if (window.wordDiscoverer) {
                    window.wordDiscoverer.refreshTextAnalysis();
                }
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