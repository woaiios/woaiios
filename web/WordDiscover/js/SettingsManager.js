/**
 * SettingsManager Module
 * Handles application settings and persistence
 */
export class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
    }

    /**
     * Get setting value
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * Set setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    /**
     * Get all settings
     * @returns {Object} All settings
     */
    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * Update multiple settings
     * @param {Object} newSettings - Settings to update
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    /**
     * Reset settings to default
     */
    resetToDefault() {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
    }

    /**
     * Export settings to JSON
     * @returns {Object} Export data
     */
    exportSettings() {
        return {
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import settings from JSON data
     * @param {Object} data - Import data
     * @returns {boolean} Success status
     */
    importSettings(data) {
        try {
            if (data.settings && typeof data.settings === 'object') {
                this.settings = { ...this.getDefaultSettings(), ...data.settings };
                this.saveSettings();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error importing settings:', error);
            return false;
        }
    }

    /**
     * Get default settings
     * @returns {Object} Default settings
     */
    getDefaultSettings() {
        return {
            highlightColor: '#ffeb3b',
            highlightOpacity: 0.7,
            translationService: 'bing',
            targetLanguage: 'zh',
            difficultyLevel: 'intermediate',
            highlightMode: 'unknown',
            autoSave: true,
            showTooltips: true,
            theme: 'light',
            fontSize: 'medium',
            enableNotifications: true,
            reviewReminder: true,
            reviewInterval: 7, // days
            googleDriveSync: false
        };
    }

    /**
     * Validate setting value
     * @param {string} key - Setting key
     * @param {*} value - Value to validate
     * @returns {boolean} Valid status
     */
    validateSetting(key, value) {
        const validators = {
            highlightColor: (val) => /^#[0-9A-F]{6}$/i.test(val),
            highlightOpacity: (val) => typeof val === 'number' && val >= 0 && val <= 1,
            translationService: (val) => ['bing', 'google', 'yandex'].includes(val),
            targetLanguage: (val) => typeof val === 'string' && val.length === 2,
            difficultyLevel: (val) => ['common', 'beginner', 'intermediate', 'advanced', 'expert'].includes(val),
            highlightMode: (val) => ['unknown', 'difficult', 'all'].includes(val),
            autoSave: (val) => typeof val === 'boolean',
            showTooltips: (val) => typeof val === 'boolean',
            theme: (val) => ['light', 'dark'].includes(val),
            fontSize: (val) => ['small', 'medium', 'large'].includes(val),
            enableNotifications: (val) => typeof val === 'boolean',
            reviewReminder: (val) => typeof val === 'boolean',
            reviewInterval: (val) => typeof val === 'number' && val > 0
        };

        const validator = validators[key];
        return validator ? validator(value) : true;
    }

    /**
     * Get setting metadata
     * @param {string} key - Setting key
     * @returns {Object} Setting metadata
     */
    getSettingMetadata(key) {
        const metadata = {
            highlightColor: {
                type: 'color',
                label: 'Highlight Color',
                description: 'Color used for highlighting words'
            },
            highlightOpacity: {
                type: 'range',
                label: 'Highlight Opacity',
                description: 'Transparency of highlighted words',
                min: 0,
                max: 1,
                step: 0.1
            },
            translationService: {
                type: 'select',
                label: 'Translation Service',
                description: 'Service used for translations',
                options: [
                    { value: 'bing', label: 'Bing Translator' },
                    { value: 'google', label: 'Google Translate' },
                    { value: 'yandex', label: 'Yandex Translate' }
                ]
            },
            targetLanguage: {
                type: 'text',
                label: 'Target Language',
                description: 'Language code for translations (e.g., zh, es, fr)'
            },
            difficultyLevel: {
                type: 'select',
                label: 'Difficulty Level',
                description: 'Base difficulty level for analysis',
                options: [
                    { value: 'common', label: 'Common' },
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' },
                    { value: 'expert', label: 'Expert' }
                ]
            },
            highlightMode: {
                type: 'select',
                label: 'Highlight Mode',
                description: 'Which words to highlight',
                options: [
                    { value: 'unknown', label: 'Unknown Words Only' },
                    { value: 'difficult', label: 'Difficult Words' },
                    { value: 'all', label: 'All Words' }
                ]
            },
            theme: {
                type: 'select',
                label: 'Theme',
                description: 'Application theme',
                options: [
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' }
                ]
            },
            fontSize: {
                type: 'select',
                label: 'Font Size',
                description: 'Text size preference',
                options: [
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' }
                ]
            }
        };

        return metadata[key] || null;
    }

    /**
     * Load settings from localStorage
     * @returns {Object} Settings object
     */
    loadSettings() {
        const defaultSettings = this.getDefaultSettings();
        const saved = localStorage.getItem('wordDiscovererSettings');
        
        if (saved) {
            try {
                const parsedSettings = JSON.parse(saved);
                // Merge with defaults to ensure all keys exist
                return { ...defaultSettings, ...parsedSettings };
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
        
        return defaultSettings;
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('wordDiscovererSettings', JSON.stringify(this.settings));
    }
}