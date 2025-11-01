/**
 * Zustand Store - Main Entry Point
 * Combines all store slices into a single store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createVocabularySlice, type VocabularySlice } from './slices/vocabularySlice';
import { createAnalysisSlice, type AnalysisSlice } from './slices/analysisSlice';
import { createGoogleDriveSlice, type GoogleDriveSlice } from './slices/googleDriveSlice';

// Combined app state type
export type AppState = SettingsSlice & VocabularySlice & AnalysisSlice & GoogleDriveSlice;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createSettingsSlice(set),
      ...createVocabularySlice(set, get),
      ...createAnalysisSlice(set),
      ...createGoogleDriveSlice(set, get),
    }),
    {
      name: 'word-discoverer-storage',
      partialize: (state: AppState) => ({
        settings: state.settings,
        vocabulary: state.vocabulary,
        googleDrive: {
          autoSync: state.googleDrive.autoSync,
          lastSync: state.googleDrive.lastSync,
        },
      }),
    }
  )
);
