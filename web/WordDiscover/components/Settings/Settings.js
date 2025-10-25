import { Modal } from '../Modal/Modal.js';

export class SettingsComponent {
    constructor(settingsManager, googleDriveManager) {
        this.settingsManager = settingsManager;
        this.googleDriveManager = googleDriveManager;
        this.modal = new Modal('#settingsModal', 'Settings');
        this.app = null;
    }

    setApp(app) {
        this.app = app;
    }

    open() {
        this.modal.open(this.renderContent());
        this.loadSettingsToUI();
        this.addEventListeners();
        this.updateGoogleDriveStatus();
    }

    addEventListeners() {
        // Settings updates
        document.getElementById('highlightOpacity').addEventListener('input', (e) => this.onOpacityChange(e));
        document.getElementById('highlightColor').addEventListener('change', (e) => this.onColorChange(e));
        document.getElementById('difficultyLevel').addEventListener('change', (e) => this.settingsManager.setSetting('difficultyLevel', e.target.value));
        document.getElementById('highlightMode').addEventListener('change', (e) => this.settingsManager.setSetting('highlightMode', e.target.value));

        // Data Management
        document.getElementById('exportSettingsBtn').addEventListener('click', () => this.onExportSettings());
        document.getElementById('importSettingsBtn').addEventListener('click', () => document.getElementById('importSettingsFile').click());
        document.getElementById('importSettingsFile').addEventListener('change', (e) => this.onImportSettingsFileChange(e));

        // Google Drive controls
        document.getElementById('enableGoogleDriveBtn').addEventListener('click', () => this.onEnableGoogleDrive());
        document.getElementById('syncNowBtn').addEventListener('click', () => this.onSyncNow());
        document.getElementById('disconnectGoogleDriveBtn').addEventListener('click', () => this.onDisconnectGoogleDrive());
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
                <div id="google-drive-section"></div>
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
    }

    onOpacityChange(event) {
        const value = parseFloat(event.target.value);
        document.getElementById('opacityValue').textContent = Math.round(value * 100) + '%';
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
    
    // ... Google Drive methods will be moved here from UIController ...
}
