/**
 * Settings Slice
 * Manages application settings state
 */

import type { AppSettings } from '../../types';

export interface SettingsSlice {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const createSettingsSlice = (set: any): SettingsSlice => ({
  settings: {
    difficultyLevel: 'intermediate',
    highlightMode: 'all',
    showTranslation: true,
    autoSave: true,
  },
  updateSettings: (newSettings: Partial<AppSettings>) =>
    set((state: any) => ({
      settings: { ...state.settings, ...newSettings },
    })),
});
