/**
 * UIController Module
 * Handles user interface interactions and DOM manipulation
 */
export class UIController {
    constructor(vocabularyManager, settingsManager) {
        this.vocabularyManager = vocabularyManager;
        this.settingsManager = settingsManager;
        this.currentHighlightedWords = new Set();
        this.tooltipElement = null;
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Main buttons
        this.addEventListener('analyzeBtn', 'click', () => this.onAnalyzeClick());
        this.addEventListener('clearBtn', 'click', () => this.onClearClick());
        
        // Modal controls
        this.addEventListener('vocabularyBtn', 'click', () => this.openVocabularyModal());
        this.addEventListener('settingsBtn', 'click', () => this.openSettingsModal());
        this.addEventListener('closeVocabModal', 'click', () => this.closeModal('vocabularyModal'));
        this.addEventListener('closeSettingsModal', 'click', () => this.closeModal('settingsModal'));
        
        // Vocabulary controls
        this.addEventListener('exportVocabBtn', 'click', () => this.onExportVocabulary());
        this.addEventListener('importVocabBtn', 'click', () => this.onImportVocabulary());
        this.addEventListener('importFile', 'change', (e) => this.onImportFileChange(e));
        this.addEventListener('clearVocabBtn', 'click', () => this.onClearVocabulary());
        this.addEventListener('syncVocabBtn', 'click', () => this.onSyncVocabulary());
        
        // Vocabulary tabs
        document.querySelectorAll('.vocab-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabClick(e));
        });

        // Settings controls
        this.addEventListener('exportSettingsBtn', 'click', () => this.onExportSettings());
        this.addEventListener('importSettingsBtn', 'click', () => this.onImportSettings());
        this.addEventListener('importSettingsFile', 'change', (e) => this.onImportSettingsFileChange(e));
        
        // Google Drive controls
        this.addEventListener('enableGoogleDriveBtn', 'click', () => this.onEnableGoogleDrive());
        this.addEventListener('syncNowBtn', 'click', () => this.onSyncNow());
        this.addEventListener('disconnectGoogleDriveBtn', 'click', () => this.onDisconnectGoogleDrive());
        
        // Settings updates
        this.addEventListener('highlightOpacity', 'input', (e) => this.onOpacityChange(e));
        this.addEventListener('highlightColor', 'change', (e) => this.onColorChange(e));
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    /**
     * Add event listener helper
     * @param {string} elementId - Element ID
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    addEventListener(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    /**
     * Update UI elements
     */
    updateUI() {
        this.updateVocabularyCount();
        this.updateSettingsUI();
    }

    /**
     * Update vocabulary count displays.
     */
    updateVocabularyCount() {
        const learningSize = this.vocabularyManager.getLearningSize();
        const masteredSize = this.vocabularyManager.masteredWords.size;

        const headerCountEl = document.getElementById('vocabCount');
        if (headerCountEl) {
            headerCountEl.textContent = learningSize;
        }
        const learningTabEl = document.getElementById('learning-count');
        if (learningTabEl) {
            learningTabEl.textContent = learningSize;
        }
        const masteredTabEl = document.getElementById('mastered-count');
        if (masteredTabEl) {
            masteredTabEl.textContent = masteredSize;
        }
    }

    /**
     * Update settings UI elements
     */
    updateSettingsUI() {
        const settings = this.settingsManager.getAllSettings();
        
        // Update highlight color
        const colorInput = document.getElementById('highlightColor');
        if (colorInput) {
            colorInput.value = settings.highlightColor;
        }
        
        // Update highlight opacity
        const opacityInput = document.getElementById('highlightOpacity');
        const opacityValue = document.getElementById('opacityValue');
        if (opacityInput && opacityValue) {
            opacityInput.value = settings.highlightOpacity;
            opacityValue.textContent = Math.round(settings.highlightOpacity * 100) + '%';
        }
        
        // Update difficulty level
        const difficultySelect = document.getElementById('difficultyLevel');
        if (difficultySelect) {
            difficultySelect.value = settings.difficultyLevel;
        }
        
        // Update highlight mode
        const highlightModeSelect = document.getElementById('highlightMode');
        if (highlightModeSelect) {
            highlightModeSelect.value = settings.highlightMode;
        }
    }

    /**
     * Display analyzed text with highlights
     * @param {string} processedText - Processed HTML text
     * @param {Function} onWordClick - Word click handler
     * @param {Function} onWordHover - Word hover handler
     */
    displayAnalyzedText(processedText) {
        const analyzedTextDiv = document.getElementById('analyzedText');
        if (!analyzedTextDiv) return;
        
        analyzedTextDiv.innerHTML = processedText;
        
        analyzedTextDiv.querySelectorAll('.word-span').forEach(element => {
            let pressTimer;
            let longPress = false;

            const word = element.dataset.word;
            const translation = element.dataset.translation;

            // Tap and Long-press for touch devices
            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                longPress = false;
                pressTimer = window.setTimeout(() => {
                    longPress = true;
                    // Long press action
                    this.handleWordUnmaster(word);
                }, 500); // 500ms for long press
            }, { passive: false });

            element.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
                if (!longPress) {
                    // Tap action
                    this.handleWordMaster(word, translation);
                }
            });

            element.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });

            // Click for non-touch devices (desktop)
            element.addEventListener('click', () => {
                this.handleWordMaster(word, translation);
            });
        });
    }

    /**
     * Handles the logic for mastering a word (tap/click action).
     * @param {string} word The word to master.
     * @param {string} translation The word's translation.
     */
    handleWordMaster(word, translation) {
        const result = this.vocabularyManager.masterWord(word, translation);
        switch (result) {
            case 'added_to_mastered':
                this.showNotification(`✅ '${word}' marked as mastered.`);
                break;
            case 'moved_to_mastered':
                this.showNotification(`✅ '${word}' moved to mastered list.`);
                break;
            case 'already_mastered':
                // Optional: show a subtle notification that it's already known
                // this.showNotification(`'${word}' is already in your mastered list.`, 'info');
                break;
        }
        this.updateUI();
    }

    /**
     * Handles the logic for moving a word to the learning list (long-press action).
     * @param {string} word The word to un-master.
     */
    handleWordUnmaster(word) {
        const result = this.vocabularyManager.unmasterWord(word);
        if (result === 'moved_to_learning') {
            this.showNotification(`📖 '${word}' moved to learning list.`);
            this.updateUI();
        }
    }

    /**
     * Update statistics display
     * @param {Object} analysis - Analysis results
     */
    updateStatistics(analysis) {
        const elements = {
            totalWords: analysis.totalWords,
            highlightedWords: analysis.highlightedWords.length,
            newWords: analysis.newWords.length,
            difficultyScore: analysis.difficultyScore,
            vocabCount: this.vocabularyManager.getTotalSize()
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    /**
     * Show/hide loading overlay
     * @param {boolean} show - Show or hide
     */
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('show');
            } else {
                overlay.classList.remove('show');
            }
        }
    }



    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     */
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.success};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 3000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Open vocabulary modal and display lists.
     */
    openVocabularyModal() {
        this.displayVocabularyLists();
        const modal = document.getElementById('vocabularyModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    /**
     * Renders both learning and mastered word lists in the vocabulary modal.
     */
    displayVocabularyLists() {
        const learningListEl = document.getElementById('learning-list');
        const masteredListEl = document.getElementById('mastered-list');
        if (!learningListEl || !masteredListEl) return;

        // Render learning list
        const learningWords = this.vocabularyManager.getSortedByDate(this.vocabularyManager.learningWords);
        this.renderList(learningListEl, learningWords, 'learning');

        // Render mastered list
        const masteredWords = this.vocabularyManager.getSortedByDate(this.vocabularyManager.masteredWords);
        this.renderList(masteredListEl, masteredWords, 'mastered');
        
        this.updateVocabularyCount();
    }

    /**
     * Helper function to render a single vocabulary list.
     * @param {HTMLElement} element - The container element for the list.
     * @param {Array} wordList - The sorted list of words to render.
     * @param {string} type - The type of list ('learning' or 'mastered').
     */
    renderList(element, wordList, type) {
        element.innerHTML = '';
        if (wordList.length === 0) {
            element.innerHTML = `<p style="text-align: center; color: #6b7280; padding: 2rem;">No words in this list yet.</p>`;
            return;
        }

        wordList.forEach(([word, data]) => {
            const actionButton = type === 'learning'
                ? `<button class="btn btn-sm btn-success" onclick="uiController.masterWord('${word}')"><i class="fas fa-check"></i> Master</button>`
                : `<button class="btn btn-sm btn-info" onclick="uiController.unmasterWord('${word}')"><i class="fas fa-undo"></i> Learn</button>`;

            const vocabItem = document.createElement('div');
            vocabItem.className = 'vocab-item';
            vocabItem.innerHTML = `
                <div>
                    <div class="vocab-word">${word}</div>
                    <div class="vocab-translation">${data.translation}</div>
                    <div class="vocab-meta">
                        Added: ${new Date(data.addedDate).toLocaleDateString()}
                        ${data.reviewCount > 0 ? ` | Reviews: ${data.reviewCount}` : ''}
                    </div>
                </div>
                <div class="vocab-actions">
                    ${actionButton}
                    <button class="btn btn-sm btn-danger" onclick="uiController.removeFromVocabulary('${word}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            element.appendChild(vocabItem);
        });
    }

    /**
     * Handles clicks on the vocabulary tabs.
     * @param {Event} event - The click event.
     */
    handleTabClick(event) {
        const clickedTab = event.target;
        const tabName = clickedTab.dataset.tab;

        // Update active state for tabs
        document.querySelectorAll('.vocab-tab').forEach(tab => tab.classList.remove('active'));
        clickedTab.classList.add('active');

        // Update active state for content
        document.querySelectorAll('.vocab-tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-list-container`).classList.add('active');
    }

    /**
     * Move a word to the mastered list.
     * @param {string} word - The word to master.
     */
    masterWord(word) {
        if (this.vocabularyManager.masterWord(word)) {
            this.displayVocabularyLists();
            this.showNotification(`"${word}" moved to mastered list.`);
        }
    }

    /**
     * Move a word back to the learning list.
     * @param {string} word - The word to un-master.
     */
    unmasterWord(word) {
        if (this.vocabularyManager.unmasterWord(word)) {
            this.displayVocabularyLists();
            this.showNotification(`"${word}" moved back to learning list.`);
        }
    }

    /**
     * Remove word from vocabulary and refresh the UI.
     * @param {string} word - Word to remove.
     */
    removeFromVocabulary(word) {
        if (confirm(`Are you sure you want to permanently delete "${word}"?`)) {
            if (this.vocabularyManager.removeWord(word)) {
                this.displayVocabularyLists();
                this.updateUI();
                this.showNotification(`"${word}" has been deleted.`, 'info');
            }
        }
    }

    /**
     * Open settings modal
     */
    openSettingsModal() {
        this.loadSettingsToUI();
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    /**
     * Load settings to UI
     */
    loadSettingsToUI() {
        const settings = this.settingsManager.getAllSettings();
        
        // Update all setting inputs
        Object.entries(settings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'range') {
                    element.value = value;
                    // Update associated display element
                    const displayElement = document.getElementById(key + 'Value');
                    if (displayElement) {
                        displayElement.textContent = Math.round(value * 100) + '%';
                    }
                } else {
                    element.value = value;
                }
            }
        });
    }

    /**
     * Close modal
     * @param {string} modalId - Modal ID
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }

    /**
     * Clear text input and hide results
     */
    clearText() {
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.value = '';
        }
        
        const analyzedTextSection = document.getElementById('analyzedTextSection');
        const statistics = document.getElementById('statistics');
        
        if (analyzedTextSection) analyzedTextSection.style.display = 'none';
        if (statistics) statistics.style.display = 'none';
    }

    /**
     * Show analyzed text section
     */
    showAnalyzedTextSection() {
        const analyzedTextSection = document.getElementById('analyzedTextSection');
        const statistics = document.getElementById('statistics');
        
        if (analyzedTextSection) analyzedTextSection.style.display = 'block';
        if (statistics) statistics.style.display = 'flex';
    }

    /**
     * Download JSON file
     * @param {Object} data - Data to download
     * @param {string} filename - Filename
     */
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

    // Event handlers
    onAnalyzeClick() {
        // This will be handled by the main app
    }

    onClearClick() {
        this.clearText();
    }

    onExportVocabulary() {
        const data = this.vocabularyManager.exportVocabulary();
        this.downloadJSON(data, 'word-discoverer-vocabulary.json');
        this.showNotification('Vocabulary exported successfully!');
    }

    onImportVocabulary() {
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.click();
        }
    }

    onImportFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (this.vocabularyManager.importVocabulary(data)) {
                    this.displayVocabularyLists();
                    this.updateUI();
                    this.showNotification('Vocabulary imported successfully!');
                } else {
                    this.showNotification('Error importing vocabulary. Please check the file format.', 'error');
                }
            } catch (error) {
                this.showNotification('Error importing vocabulary. Please check the file format.', 'error');
            }
        };
        reader.readAsText(file);
    }

    onClearVocabulary() {
        if (confirm('Clear all vocabulary (both learning and mastered)? This action cannot be undone.')) {
            this.vocabularyManager.clearVocabulary();
            this.displayVocabularyLists();
            this.updateUI();
            this.showNotification('All vocabulary has been cleared.');
        }
    }

    onExportSettings() {
        const data = this.settingsManager.exportSettings();
        this.downloadJSON(data, 'settings.json');
        this.showNotification('Settings exported successfully!');
    }

    onImportSettings() {
        const fileInput = document.getElementById('importSettingsFile');
        if (fileInput) {
            fileInput.click();
        }
    }

    onImportSettingsFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (this.settingsManager.importSettings(data)) {
                    this.loadSettingsToUI();
                    this.updateUI();
                    this.showNotification('Settings imported successfully!');
                } else {
                    this.showNotification('Error importing settings. Please check the file format.', 'error');
                }
            } catch (error) {
                this.showNotification('Error importing settings. Please check the file format.', 'error');
            }
        };
        reader.readAsText(file);
    }

    onOpacityChange(event) {
        const value = parseFloat(event.target.value);
        const displayElement = document.getElementById('opacityValue');
        if (displayElement) {
            displayElement.textContent = Math.round(value * 100) + '%';
        }
        this.settingsManager.setSetting('highlightOpacity', value);
    }

    onColorChange(event) {
        this.settingsManager.setSetting('highlightColor', event.target.value);
    }

    // Google Drive event handlers
    async onSyncVocabulary() {
        try {
            this.showLoading(true);
            const success = await this.vocabularyManager.syncToGoogleDrive();
            if (success) {
                this.showNotification('Vocabulary synced to Google Drive successfully!');
                await this.updateGoogleDriveStatus();
            } else {
                this.showNotification('Failed to sync vocabulary to Google Drive.', 'error');
            }
        } catch (error) {
            console.error('Error syncing vocabulary:', error);
            this.showNotification('Error syncing vocabulary to Google Drive.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async onEnableGoogleDrive() {
        try {
            this.showLoading(true);
            const success = await this.vocabularyManager.enableGoogleDriveSync();
            if (success) {
                this.showNotification('Google Drive sync enabled successfully!');
                this.settingsManager.setSetting('googleDriveSync', true);
                await this.updateGoogleDriveStatus();
            } else {
                this.showNotification('Failed to enable Google Drive sync.', 'error');
            }
        } catch (error) {
            console.error('Error enabling Google Drive sync:', error);
            this.showNotification('Error enabling Google Drive sync.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async onSyncNow() {
        try {
            this.showLoading(true);
            const success = await this.vocabularyManager.syncToGoogleDrive();
            if (success) {
                this.showNotification('Sync completed successfully!');
                await this.updateGoogleDriveStatus();
            } else {
                this.showNotification('Sync failed.', 'error');
            }
        } catch (error) {
            console.error('Error syncing:', error);
            this.showNotification('Error syncing to Google Drive.', 'error');
        }
    } finally {
            this.showLoading(false);
        }
    }

    async onDisconnectGoogleDrive() {
        try {
            if (confirm('Disconnect from Google Drive? This will stop automatic syncing.')) {
                const success = await this.vocabularyManager.disableGoogleDriveSync();
                if (success) {
                    this.showNotification('Disconnected from Google Drive.');
                    this.settingsManager.setSetting('googleDriveSync', false);
                    await this.updateGoogleDriveStatus();
                } else {
                    this.showNotification('Failed to disconnect from Google Drive.', 'error');
                }
            }
        } catch (error) {
            console.error('Error disconnecting from Google Drive:', error);
            this.showNotification('Error disconnecting from Google Drive.', 'error');
        }
    }

    /**
     * Update Google Drive status display
     */
    async updateGoogleDriveStatus() {
        const status = await this.vocabularyManager.getGoogleDriveStatus();
        
        // Update status indicator
        const statusIndicator = document.getElementById('syncStatusIndicator');
        const statusText = document.getElementById('syncStatusText');
        
        if (statusIndicator && statusText) {
            statusIndicator.className = 'status-indicator';
            
            if (status.syncEnabled && status.isSignedIn) {
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connected to Google Drive';
            } else {
                statusText.textContent = 'Not connected';
            }
        }

        // Update user info
        const userInfo = document.getElementById('userInfo');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        
        if (userInfo && status.userInfo) {
            userInfo.style.display = 'flex';
            if (userAvatar) userAvatar.src = status.userInfo.imageUrl;
            if (userName) userName.textContent = status.userInfo.name;
            if (userEmail) userEmail.textContent = status.userInfo.email;
        } else if (userInfo) {
            userInfo.style.display = 'none';
        }

        // Update sync controls
        const enableBtn = document.getElementById('enableGoogleDriveBtn');
        const syncNowBtn = document.getElementById('syncNowBtn');
        const disconnectBtn = document.getElementById('disconnectGoogleDriveBtn');
        
        if (enableBtn && syncNowBtn && disconnectBtn) {
            if (status.syncEnabled && status.isSignedIn) {
                enableBtn.style.display = 'none';
                syncNowBtn.style.display = 'inline-flex';
                disconnectBtn.style.display = 'inline-flex';
            } else {
                enableBtn.style.display = 'inline-flex';
                syncNowBtn.style.display = 'none';
                disconnectBtn.style.display = 'none';
            }
        }

        // Update sync info
        const syncInfo = document.getElementById('syncInfo');
        const lastSyncTime = document.getElementById('lastSyncTime');
        
        if (syncInfo && lastSyncTime) {
            if (status.lastSyncTime) {
                syncInfo.style.display = 'block';
                const syncDate = new Date(status.lastSyncTime);
                lastSyncTime.textContent = syncDate.toLocaleString();
            } else {
                syncInfo.style.display = 'none';
            }
        }
    }

    /**
     * Initialize Google Drive integration
     */
    async initializeGoogleDrive() {
        try {
            await this.vocabularyManager.initializeGoogleDrive();
            await this.updateGoogleDriveStatus();
        } catch (error) {
            console.error('Error initializing Google Drive:', error);
        }
    }
}

