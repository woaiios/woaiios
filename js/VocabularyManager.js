/**
 * VocabularyManager Module
 * Handles vocabulary management and persistence with separate lists for learning and mastered words.
 */
import { GoogleDriveManager } from './GoogleDriveManager.js';
import { storageHelper } from './StorageHelper.js';
import { glossCache } from './analyzers/GlossCache.js';

export class VocabularyManager {
    constructor() {
        this.learningWords = new Map();
        this.masteredWords = new Map();
        this.isLoading = false;
        this.isLoaded = false;
        
        this.googleDriveManager = new GoogleDriveManager();
        this.syncEnabled = false;
        this.lastSyncTime = null;
        this.isSyncing = false;
        this.googleDriveSyncKey = 'wordDiscovererGoogleDriveSync';  // 同步开关持久化键 (Persisted sync toggle key)
        this.glossSyncDebounceMs = 30000;  // 释义缓存防抖同步间隔 (Gloss cache sync debounce)
        this._glossSyncTimer = null;

        // LLM 释义缓存出现新条目时防抖触发云端同步
        // (Debounced cloud sync when new LLM gloss cache entries appear)
        glossCache.onDirty = () => this._scheduleGlossCacheSync();

        // Initialize async - load vocabulary in background
        this.initialize();
    }

    /**
     * Initialize the vocabulary manager asynchronously
     */
    async initialize() {
        this.isLoading = true;
        try {
            const { learningWords, masteredWords } = await this.loadVocabulary();
            this.learningWords = learningWords;
            this.masteredWords = masteredWords;
            this.isLoaded = true;
            console.log('✅ VocabularyManager initialized with', this.learningWords.size, 'learning words and', this.masteredWords.size, 'mastered words');

            // 后台恢复 Google Drive 同步（不阻塞应用启动）
            // (Restore Google Drive sync in background, non-blocking)
            this._restoreGoogleDriveSync().catch((error) => {
                console.warn('⚠️ Google Drive sync restore failed:', error);
            });
        } catch (error) {
            console.error('Error initializing VocabularyManager:', error);
            this.isLoaded = true; // Continue with empty vocabulary
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Wait for initialization to complete
     */
    async waitForInit() {
        if (this.isLoaded) return;
        
        // Poll until loaded
        await new Promise(resolve => {
            const check = () => {
                if (this.isLoaded) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    /**
     * Add a new word to the learning list.
     * @param {string} word - Word to add.
     * @param {string} translation - Translation of the word.
     * @returns {Promise<boolean>} True if the word was added, false if it already exists.
     */
    async addWord(word, translation) {
        await this.waitForInit();
        
        const lowerCaseWord = word.toLowerCase();
        if (this.isKnownWord(lowerCaseWord)) {
            return false;
        }
        
        this.learningWords.set(lowerCaseWord, {
            translation: translation,
            addedDate: new Date().toISOString(),
            reviewCount: 0,
            lastReviewed: null
        });
        
        await this.saveVocabulary();
        return true;
    }

    /**
     * Move a word from the learning list to the mastered list.
     * @param {string} word - The word to master.
     * @returns {Promise<string>} Status of the operation.
     */
    async masterWord(word, translation) {
        await this.waitForInit();
        
        const lowerCaseWord = word.toLowerCase();
        if (this.masteredWords.has(lowerCaseWord)) {
            return 'already_mastered';
        }

        let wordData;
        if (this.learningWords.has(lowerCaseWord)) {
            wordData = this.learningWords.get(lowerCaseWord);
            this.learningWords.delete(lowerCaseWord);
            this.masteredWords.set(lowerCaseWord, wordData);
            await this.saveVocabulary();
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
        await this.saveVocabulary();
        return 'added_to_mastered';
    }

    /**
     * Move a word from the mastered list back to the learning list.
     * @param {string} word - The word to un-master.
     * @returns {Promise<string|boolean>} 'moved_to_learning' on success, false otherwise.
     */
    async unmasterWord(word) {
        await this.waitForInit();
        
        const lowerCaseWord = word.toLowerCase();
        if (this.masteredWords.has(lowerCaseWord)) {
            const wordData = this.masteredWords.get(lowerCaseWord);
            this.masteredWords.delete(lowerCaseWord);
            this.learningWords.set(lowerCaseWord, wordData);
            await this.saveVocabulary();
            return 'moved_to_learning';
        }
        return false;
    }

    /**
     * Remove a word from all vocabulary lists.
     * @param {string} word - Word to remove.
     * @returns {Promise<boolean>} True if the word was removed, false if not found.
     */
    async removeWord(word) {
        await this.waitForInit();
        
        if (this.learningWords.has(word)) {
            this.learningWords.delete(word);
            await this.saveVocabulary();
            return true;
        }
        if (this.masteredWords.has(word)) {
            this.masteredWords.delete(word);
            await this.saveVocabulary();
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
        const lowerCaseWord = word.toLowerCase();
        return this.learningWords.has(lowerCaseWord) || this.masteredWords.has(lowerCaseWord);
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
    async clearVocabulary() {
        await this.waitForInit();
        
        this.learningWords.clear();
        this.masteredWords.clear();
        await this.saveVocabulary();
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
     * @returns {Promise<boolean>} True if updated, false otherwise.
     */
    async updateReviewCount(word) {
        await this.waitForInit();
        
        const wordData = this.learningWords.get(word);
        if (wordData) {
            wordData.reviewCount++;
            wordData.lastReviewed = new Date().toISOString();
            await this.saveVocabulary();
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
     * @returns {Promise<{learningWords: Map, masteredWords: Map}>}
     */
    async loadVocabulary() {
        const saved = await storageHelper.getItem('wordDiscovererVocabulary');
        if (!saved) {
            return { learningWords: new Map(), masteredWords: new Map() };
        }

        try {
            // Check for new format (v2.0)
            if (saved.version === '2.0') {
                return {
                    learningWords: new Map(saved.learningWords || []),
                    masteredWords: new Map(saved.masteredWords || [])
                };
            }
            
            // Check for old format (Array of entries) and migrate
            if (Array.isArray(saved)) {
                console.log('Migrating old vocabulary format to new v2.0 format.');
                return {
                    learningWords: new Map(saved),
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
    async saveVocabulary() {
        const dataToSave = {
            version: '2.0',
            learningWords: Array.from(this.learningWords.entries()),
            masteredWords: Array.from(this.masteredWords.entries())
        };
        
        await storageHelper.setItem('wordDiscovererVocabulary', dataToSave);
        
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
                await this._persistGoogleDriveSync();

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
            if (this._glossSyncTimer) {
                clearTimeout(this._glossSyncTimer);
                this._glossSyncTimer = null;
            }
            await this._persistGoogleDriveSync();
            await this.googleDriveManager.signOut();
            console.log('Google Drive sync disabled');
            return true;
        } catch (error) {
            console.error('Error disabling Google Drive sync:', error);
            return false;
        }
    }

    /**
     * Restore Google Drive sync state at startup
     * Reads the persisted sync toggle; if enabled, silently re-signs-in
     * and performs the initial sync in the background.
     * @returns {Promise<boolean>} Whether sync was restored
     * @private
     */
    async _restoreGoogleDriveSync() {
        const state = await storageHelper.getItem(this.googleDriveSyncKey);
        if (!state || state.syncEnabled !== true) {
            return false;
        }

        // 恢复上次同步时间用于 UI 显示 (Restore last sync time for UI display)
        this.lastSyncTime = state.lastSyncTime || null;
        this.syncEnabled = true;
        console.log('🔄 Google Drive sync enabled in persisted state, restoring session...');

        const restored = await this.googleDriveManager.restoreSession();
        if (restored) {
            // 静默恢复成功，执行启动同步 (Silent restore succeeded, perform startup sync)
            await this.syncToGoogleDrive();
            return true;
        }

        // 恢复失败（令牌失效/无 Google 会话），保留 syncEnabled 状态
        // 下次刷新时仍会尝试恢复，用户也可手动重连
        // (Restore failed: keep syncEnabled so next reload will retry; user can also manually reconnect)
        console.warn('⚠️ Google Drive restore failed, will retry on next load');
        return false;
    }

    /**
     * Persist Google Drive sync toggle and last sync time
     * @returns {Promise<boolean>} Whether persistence succeeded
     * @private
     */
    async _persistGoogleDriveSync() {
        return storageHelper.setItem(this.googleDriveSyncKey, {
            syncEnabled: this.syncEnabled,
            lastSyncTime: this.lastSyncTime
        });
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
                        window.wordDiscoverer.analyzeText();
                    }
                } else if (syncResult.action === 'download') {
                    // This case is for compatibility if sync logic changes back.
                    this.importVocabulary(syncResult.data);
                    console.log('Vocabulary synced from Google Drive');
                    // 在这里添加文本分析刷新调用
                    if (window.wordDiscoverer) {
                        window.wordDiscoverer.analyzeText();
                    }
                } else if (syncResult.action === 'upload') {
                    console.log('Vocabulary uploaded to Google Drive');
                }
                
                this.lastSyncTime = new Date().toISOString();
                await this._persistGoogleDriveSync();

                // 释义缓存与词汇本一起同步（union 合并，失败不影响词汇同步结果）
                // (Sync gloss cache along with vocabulary; failures are non-fatal)
                this._syncGlossCache().catch((error) => {
                    console.warn('⚠️ Gloss cache sync failed:', error);
                });

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
     * 防抖调度释义缓存同步 - Schedule debounced gloss cache sync
     * LLM 批量返回释义时会连续写缓存，这里等安静 30 秒后一次性同步，
     * 避免每个新释义都打一次 Drive API。
     * @private
     */
    _scheduleGlossCacheSync() {
        if (!this.syncEnabled || !this.googleDriveManager.isSignedIn) return;
        if (this._glossSyncTimer) return;
        this._glossSyncTimer = setTimeout(() => {
            this._glossSyncTimer = null;
            this._syncGlossCache().catch((error) => {
                console.warn('⚠️ Gloss cache sync failed:', error);
            });
        }, this.glossSyncDebounceMs);
    }

    /**
     * 同步 LLM 释义缓存到 Google Drive - Sync LLM gloss cache to Google Drive
     * 远程条目通过 union 合并回流本地，实现跨设备共享。
     * @returns {Promise<boolean>} 是否成功
     */
    async _syncGlossCache() {
        if (!this.syncEnabled || !this.googleDriveManager.isSignedIn) {
            return false;
        }
        try {
            await glossCache.waitForLoad();
            const result = await this.googleDriveManager.syncGlossCache(glossCache.exportData());
            if (result.success) {
                if (result.action === 'merge' && result.data) {
                    // 合并远程缓存回流本地（新增条目立即生效，免去重复请求）
                    glossCache.importData(result.data);
                    console.log('Gloss cache merged with Google Drive,', glossCache.size, 'entries');
                } else {
                    console.log('Gloss cache uploaded to Google Drive,', glossCache.size, 'entries');
                }
                return true;
            }
            console.warn('⚠️ Gloss cache sync failed:', result.error);
            return false;
        } catch (error) {
            console.error('Error syncing gloss cache:', error);
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
                // 在这里添加文本分析刷新调用
                if (window.wordDiscoverer) {
                    window.wordDiscoverer.analyzeText();
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