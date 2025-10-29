/**
 * SettingsManager Module
 * 设置管理器模块
 * 
 * 功能特性 (Features):
 * - 应用设置的集中管理 (Centralized management of application settings)
 * - 本地存储持久化 (Local storage persistence)
 * - 设置验证机制 (Settings validation mechanism)
 * - 导入/导出设置 (Import/export settings)
 * - 默认设置恢复 (Reset to default settings)
 * - 设置元数据管理 (Settings metadata management)
 * 
 * @class SettingsManager
 */
export class SettingsManager {
    /**
     * 构造函数 - Constructor
     * 从本地存储加载设置或使用默认值 (Load settings from local storage or use defaults)
     */
    constructor() {
        this.settings = this.loadSettings();
    }

    /**
     * 获取设置值 - Get setting value
     * @param {string} key - 设置键名 (Setting key)
     * @returns {*} 设置值 (Setting value)
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * 设置值并保存 - Set setting value and save
     * @param {string} key - 设置键名 (Setting key)
     * @param {*} value - 设置值 (Setting value)
     */
    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    /**
     * 获取所有设置 - Get all settings
     * 返回设置的副本以防止外部修改 (Return copy to prevent external modification)
     * @returns {Object} 所有设置 (All settings)
     */
    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * 批量更新设置 - Update multiple settings
     * @param {Object} newSettings - 要更新的设置对象 (Settings object to update)
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    /**
     * 重置为默认设置 - Reset settings to default
     * 恢复所有设置为出厂默认值 (Restore all settings to factory defaults)
     */
    resetToDefault() {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
    }

    /**
     * 导出设置为 JSON - Export settings to JSON
     * 用于备份和迁移设置 (For backup and migration of settings)
     * @returns {Object} 导出数据对象 (Export data object)
     */
    exportSettings() {
        return {
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * 从 JSON 数据导入设置 - Import settings from JSON data
     * 用于恢复备份的设置 (For restoring backed-up settings)
     * @param {Object} data - 导入数据对象 (Import data object)
     * @returns {boolean} 是否导入成功 (Whether import succeeded)
     */
    importSettings(data) {
        try {
            if (data.settings && typeof data.settings === 'object') {
                // 与默认设置合并，确保所有键都存在 (Merge with defaults to ensure all keys exist)
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
     * 获取默认设置 - Get default settings
     * 定义所有可用设置及其默认值 (Define all available settings and their defaults)
     * @returns {Object} 默认设置对象 (Default settings object)
     */
    getDefaultSettings() {
        return {
            highlightColor: '#ffeb3b',              // 高亮颜色 (Highlight color)
            highlightOpacity: 0.7,                  // 高亮透明度 (Highlight opacity)
            translationService: 'bing',             // 翻译服务 (Translation service)
            targetLanguage: 'zh',                   // 目标语言 (Target language)
            difficultyLevel: 'intermediate',        // 难度级别 (Difficulty level)
            highlightMode: 'unknown',               // 高亮模式 (Highlight mode)
            autoSave: true,                         // 自动保存 (Auto save)
            showTooltips: true,                     // 显示提示 (Show tooltips)
            theme: 'light',                         // 主题 (Theme)
            fontSize: 'medium',                     // 字体大小 (Font size)
            enableNotifications: true,              // 启用通知 (Enable notifications)
            reviewReminder: true,                   // 复习提醒 (Review reminder)
            reviewInterval: 7,                      // 复习间隔（天）(Review interval in days)
            googleDriveSync: false                  // Google Drive 同步 (Google Drive sync)
        };
    }

    /**
     * 验证设置值 - Validate setting value
     * 确保设置值符合预期的类型和范围 (Ensure setting value matches expected type and range)
     * @param {string} key - 设置键名 (Setting key)
     * @param {*} value - 要验证的值 (Value to validate)
     * @returns {boolean} 是否有效 (Whether valid)
     */
    validateSetting(key, value) {
        // 定义每个设置的验证规则 (Define validation rules for each setting)
        const validators = {
            highlightColor: (val) => /^#[0-9A-F]{6}$/i.test(val),  // 必须是十六进制颜色代码 (Must be hex color code)
            highlightOpacity: (val) => typeof val === 'number' && val >= 0 && val <= 1,  // 必须是 0-1 的数字 (Must be number 0-1)
            translationService: (val) => ['bing', 'google', 'yandex'].includes(val),  // 必须是支持的服务 (Must be supported service)
            targetLanguage: (val) => typeof val === 'string' && val.length === 2,  // 必须是两字母语言代码 (Must be 2-letter lang code)
            difficultyLevel: (val) => ['common', 'beginner', 'intermediate', 'advanced', 'expert'].includes(val),
            highlightMode: (val) => ['unknown', 'difficult', 'all'].includes(val),
            autoSave: (val) => typeof val === 'boolean',
            showTooltips: (val) => typeof val === 'boolean',
            theme: (val) => ['light', 'dark'].includes(val),
            fontSize: (val) => ['small', 'medium', 'large'].includes(val),
            enableNotifications: (val) => typeof val === 'boolean',
            reviewReminder: (val) => typeof val === 'boolean',
            reviewInterval: (val) => typeof val === 'number' && val > 0  // 必须是正数 (Must be positive number)
        };

        const validator = validators[key];
        return validator ? validator(value) : true;  // 未定义验证器的键默认通过 (Undefined validators pass by default)
    }

    /**
     * 获取设置元数据 - Get setting metadata
     * 提供 UI 渲染所需的设置信息 (Provide setting info needed for UI rendering)
     * @param {string} key - 设置键名 (Setting key)
     * @returns {Object|null} 设置元数据对象或 null (Setting metadata object or null)
     */
    getSettingMetadata(key) {
        // 设置元数据映射表 (Setting metadata map)
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
     * 从本地存储加载设置 - Load settings from localStorage
     * 如果没有保存的设置，返回默认设置 (Return defaults if no saved settings)
     * @returns {Object} 设置对象 (Settings object)
     */
    loadSettings() {
        const defaultSettings = this.getDefaultSettings();
        const saved = localStorage.getItem('wordDiscovererSettings');
        
        if (saved) {
            try {
                const parsedSettings = JSON.parse(saved);
                // 与默认设置合并以确保所有键都存在 (Merge with defaults to ensure all keys exist)
                return { ...defaultSettings, ...parsedSettings };
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
        
        return defaultSettings;
    }

    /**
     * 保存设置到本地存储 - Save settings to localStorage
     * 将当前设置序列化并存储 (Serialize and store current settings)
     */
    saveSettings() {
        localStorage.setItem('wordDiscovererSettings', JSON.stringify(this.settings));
    }
}