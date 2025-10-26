import { Modal } from '../Modal/Modal.js';

export class SettingsComponent {
    constructor(settingsManager, googleDriveManager) {
        this.settingsManager = settingsManager;
        this.googleDriveManager = googleDriveManager;
        this.modal = new Modal('#settingsModal', 'Settings');
        this.app = null;
        this.userInfo = null;
        this.lastSyncTime = null;
    }

    setApp(app) {
        this.app = app;
    }

    open() {
        this.modal.open(this.renderContent());
        this.loadSettingsToUI();
        this.addEventListeners(); // Now the elements exist, we can attach event listeners
        this.updateGoogleDriveStatus();
    }

    addEventListeners() {
        // Check that elements exist before adding event listeners to prevent "Cannot read properties of null" errors
        const highlightOpacity = document.getElementById('highlightOpacity');
        if (highlightOpacity) {
            highlightOpacity.addEventListener('input', (e) => this.onOpacityChange(e));
        }
        
        const highlightColor = document.getElementById('highlightColor');
        if (highlightColor) {
            highlightColor.addEventListener('change', (e) => this.onColorChange(e));
        }
        
        const difficultyLevel = document.getElementById('difficultyLevel');
        if (difficultyLevel) {
            difficultyLevel.addEventListener('change', (e) => {
                this.settingsManager.setSetting('difficultyLevel', e.target.value);
                // Also update the main page difficulty level selector
                const mainDifficultyLevel = document.getElementById('mainDifficultyLevel');
                if (mainDifficultyLevel && mainDifficultyLevel.value !== e.target.value) {
                    mainDifficultyLevel.value = e.target.value;
                }
            });
        }
        
        const highlightMode = document.getElementById('highlightMode');
        if (highlightMode) {
            highlightMode.addEventListener('change', (e) => {
                this.settingsManager.setSetting('highlightMode', e.target.value);
                // Also update the main page highlight mode selector
                const mainHighlightMode = document.getElementById('mainHighlightMode');
                if (mainHighlightMode && mainHighlightMode.value !== e.target.value) {
                    mainHighlightMode.value = e.target.value;
                }
            });
        }

        // Data Management
        const exportSettingsBtn = document.getElementById('exportSettingsBtn');
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => this.onExportSettings());
        }
        
        const importSettingsBtn = document.getElementById('importSettingsBtn');
        if (importSettingsBtn) {
            importSettingsBtn.addEventListener('click', () => {
                const importSettingsFile = document.getElementById('importSettingsFile');
                if (importSettingsFile) {
                    importSettingsFile.click();
                }
            });
        }
        
        const importSettingsFile = document.getElementById('importSettingsFile');
        if (importSettingsFile) {
            importSettingsFile.addEventListener('change', (e) => this.onImportSettingsFileChange(e));
        }

        // Google Drive controls
        const enableGoogleDriveBtn = document.getElementById('enableGoogleDriveBtn');
        if (enableGoogleDriveBtn) {
            enableGoogleDriveBtn.addEventListener('click', () => this.onEnableGoogleDrive());
        }
        
        const syncNowBtn = document.getElementById('syncNowBtn');
        if (syncNowBtn) {
            syncNowBtn.addEventListener('click', () => this.onSyncNow());
        }
        
        const disconnectGoogleDriveBtn = document.getElementById('disconnectGoogleDriveBtn');
        if (disconnectGoogleDriveBtn) {
            disconnectGoogleDriveBtn.addEventListener('click', () => this.onDisconnectGoogleDrive());
        }
    }

    renderContent() {
        return `
            <div class="settings-section">
                <h3>Highlighting</h3>
                <div class="setting-item">
                    <label for="highlightColor">Highlight Color:</label>
                    <input type="color" id="highlightColor">
                </div>
                <div class="setting-item">
                    <label for="highlightOpacity">Opacity:</label>
                    <input type="range" id="highlightOpacity" min="0.1" max="1" step="0.1">
                    <span id="opacityValue"></span>
                </div>
            </div>
            <div class="settings-section">
                <h3>Analysis</h3>
                <div class="setting-item">
                    <label for="difficultyLevel">Difficulty Level:</label>
                    <select id="difficultyLevel">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label for="highlightMode">Highlight Mode:</label>
                    <select id="highlightMode">
                        <option value="unknown">Unknown Words Only</option>
                        <option value="difficult">Difficult Words</option>
                        <option value="all">All Words</option>
                    </select>
                </div>
            </div>
            <div class="settings-section">
                <h3>Google Drive Sync</h3>
                <!-- Google Drive UI will be rendered here -->
                <div id="google-drive-section">${this.renderGoogleDriveUI()}</div>
            </div>
            <div class="settings-section">
                <h3>Data Management</h3>
                <div class="setting-item">
                    <button class="btn btn-primary" id="exportSettingsBtn"><i class="fas fa-download"></i> Export Settings</button>
                    <button class="btn btn-secondary" id="importSettingsBtn"><i class="fas fa-upload"></i> Import Settings</button>
                    <input type="file" id="importSettingsFile" accept=".json" style="display: none;">
                </div>
            </div>
        `;
    }

    renderGoogleDriveUI() {
        const authStatus = this.googleDriveManager.getAuthStatus();
        
        if (!authStatus.isInitialized) {
            return `
                <div class="google-drive-status">
                    <div class="status-indicator">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>Google Drive not initialized</span>
                    </div>
                    <button class="btn btn-primary" id="enableGoogleDriveBtn">
                        <i class="fab fa-google"></i> Initialize Google Drive
                    </button>
                </div>
            `;
        }
        
        if (!authStatus.isSignedIn) {
            return `
                <div class="google-drive-status">
                    <div class="status-indicator">
                        <i class="fas fa-unlink"></i>
                        <span>Google Drive not connected</span>
                    </div>
                    <button class="btn btn-success" id="enableGoogleDriveBtn">
                        <i class="fab fa-google"></i> Connect to Google Drive
                    </button>
                </div>
            `;
        }
        
        // User is signed in - show user info and sync controls
        return `
            <div class="google-drive-status">
                <div class="user-info">
                    ${this.userInfo && this.userInfo.imageUrl ? 
                        `<img src="${this.userInfo.imageUrl}" alt="User Avatar" class="user-avatar">` : 
                        `<div class="user-avatar-placeholder"><i class="fas fa-user"></i></div>`}
                    <div class="user-details">
                        <div class="user-name">${this.userInfo?.name || 'Google User'}</div>
                        <div class="user-email">${this.userInfo?.email || 'No email provided'}</div>
                    </div>
                </div>
                
                <div class="sync-controls">
                    <button class="btn btn-primary" id="syncNowBtn">
                        <i class="fas fa-sync-alt"></i> Sync Now
                    </button>
                    <button class="btn btn-secondary" id="disconnectGoogleDriveBtn">
                        <i class="fas fa-sign-out-alt"></i> Disconnect
                    </button>
                </div>
                
                ${this.lastSyncTime ? 
                    `<div class="sync-info">
                        <div class="last-sync">
                            <i class="fas fa-check-circle"></i>
                            <span>Last synced: ${new Date(this.lastSyncTime).toLocaleString()}</span>
                        </div>
                    </div>` : 
                    `<div class="sync-info">
                        <div class="last-sync">
                            <i class="fas fa-info-circle"></i>
                            <span>Never synced</span>
                        </div>
                    </div>`}
            </div>
        `;
    }

    async updateGoogleDriveStatus() {
        try {
            // Get user info if signed in
            if (this.googleDriveManager.isSignedIn) {
                this.userInfo = await this.googleDriveManager.getUserInfo();
            }
            
            // Update the Google Drive section in the UI
            const googleDriveSection = document.getElementById('google-drive-section');
            if (googleDriveSection) {
                googleDriveSection.innerHTML = this.renderGoogleDriveUI();
                // Re-attach event listeners for the new elements
                this.addEventListeners();
            }
        } catch (error) {
            console.error('Error updating Google Drive status:', error);
        }
    }

    loadSettingsToUI() {
        const settings = this.settingsManager.getAllSettings();
        Object.entries(settings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'range') {
                    element.value = value;
                    const displayElement = document.getElementById(key + 'Value');
                    if (displayElement) displayElement.textContent = Math.round(value * 100) + '%';
                } else {
                    element.value = value;
                }
            }
        });
        
        // Also update the main page selectors to match current settings
        const mainDifficultyLevel = document.getElementById('mainDifficultyLevel');
        if (mainDifficultyLevel) {
            mainDifficultyLevel.value = settings.difficultyLevel || 'intermediate';
        }
        
        const mainHighlightMode = document.getElementById('mainHighlightMode');
        if (mainHighlightMode) {
            mainHighlightMode.value = settings.highlightMode || 'unknown';
        }
    }

    onOpacityChange(event) {
        const value = parseFloat(event.target.value);
        const opacityValue = document.getElementById('opacityValue');
        if (opacityValue) {
            opacityValue.textContent = Math.round(value * 100) + '%';
        }
        this.settingsManager.setSetting('highlightOpacity', value);
    }

    onColorChange(event) {
        this.settingsManager.setSetting('highlightColor', event.target.value);
    }

    onExportSettings() {
        const data = this.settingsManager.exportSettings();
        this.app.downloadJSON(data, 'settings.json');
        this.app.showNotification('Settings exported successfully!');
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
                    this.app.showNotification('Settings imported successfully!');
                } else {
                    this.app.showNotification('Error importing settings.', 'error');
                }
            } catch (error) {
                this.app.showNotification('Error importing settings.', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    async onEnableGoogleDrive() {
        try {
            // Show loading state
            const enableBtn = document.getElementById('enableGoogleDriveBtn');
            if (enableBtn) {
                enableBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                enableBtn.disabled = true;
            }
            
            // Initialize if needed
            if (!this.googleDriveManager.isInitialized) {
                await this.googleDriveManager.initialize();
            }
            
            // Sign in
            const success = await this.googleDriveManager.signIn();
            if (success) {
                this.app.showNotification('Successfully connected to Google Drive!');
                await this.updateGoogleDriveStatus();
            } else {
                this.app.showNotification('Failed to connect to Google Drive.', 'error');
                if (enableBtn) {
                    enableBtn.innerHTML = '<i class="fab fa-google"></i> Connect to Google Drive';
                    enableBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Error enabling Google Drive:', error);
            this.app.showNotification('Error connecting to Google Drive.', 'error');
            const enableBtn = document.getElementById('enableGoogleDriveBtn');
            if (enableBtn) {
                enableBtn.innerHTML = '<i class="fab fa-google"></i> Connect to Google Drive';
                enableBtn.disabled = false;
            }
        }
    }
    
    async onSyncNow() {
        try {
            // Show syncing state
            const syncBtn = document.getElementById('syncNowBtn');
            if (syncBtn) {
                const originalText = syncBtn.innerHTML;
                syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
                syncBtn.disabled = true;
                
                try {
                    // Perform sync
                    const vocabData = this.app.vocabularyManager.exportVocabulary();
                    const syncResult = await this.googleDriveManager.syncVocabulary(vocabData);
                    
                    if (syncResult.success) {
                        this.lastSyncTime = new Date();
                        this.app.showNotification('Successfully synced with Google Drive!');
                        await this.updateGoogleDriveStatus();
                        
                        // If we downloaded new data, update the local vocabulary
                        if (syncResult.action === 'download' || syncResult.action === 'merge') {
                            this.app.vocabularyManager.importVocabulary(syncResult.data);
                            this.app.updateCounts();
                            this.app.showNotification('Vocabulary updated from Google Drive!');
                        }
                    } else {
                        this.app.showNotification('Failed to sync with Google Drive: ' + syncResult.error, 'error');
                    }
                } finally {
                    // Restore button
                    syncBtn.innerHTML = originalText;
                    syncBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Error syncing with Google Drive:', error);
            this.app.showNotification('Error syncing with Google Drive.', 'error');
            const syncBtn = document.getElementById('syncNowBtn');
            if (syncBtn) {
                syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Now';
                syncBtn.disabled = false;
            }
        }
    }
    
    async onDisconnectGoogleDrive() {
        try {
            const success = await this.googleDriveManager.signOut();
            if (success) {
                this.userInfo = null;
                this.lastSyncTime = null;
                this.app.showNotification('Disconnected from Google Drive.');
                await this.updateGoogleDriveStatus();
            } else {
                this.app.showNotification('Failed to disconnect from Google Drive.', 'error');
            }
        } catch (error) {
            console.error('Error disconnecting from Google Drive:', error);
            this.app.showNotification('Error disconnecting from Google Drive.', 'error');
        }
    }
}