/**
 * Google Drive Slice
 * Manages Google Drive synchronization state and operations
 */

import { GoogleDriveService } from '../../services/GoogleDriveService';

interface UserInfo {
  name: string;
  email: string;
  photo?: string;
}

export interface GoogleDriveState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  lastSync: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  autoSync: boolean;
}

export interface GoogleDriveSlice {
  googleDrive: GoogleDriveState;
  initGoogleDrive: () => Promise<void>;
  signInToGoogleDrive: () => Promise<void>;
  signOutFromGoogleDrive: () => Promise<void>;
  syncToGoogleDrive: () => Promise<void>;
  setGoogleDriveAutoSync: (enabled: boolean) => void;
}

export const createGoogleDriveSlice = (set: any, get: any): GoogleDriveSlice => ({
  googleDrive: {
    isAuthenticated: false,
    user: null,
    lastSync: null,
    syncStatus: 'idle',
    autoSync: false,
  },
  
  initGoogleDrive: async () => {
    try {
      const driveService = GoogleDriveService.getInstance();
      await driveService.initialize();
      
      if (driveService.isAuthenticated()) {
        const user = await driveService.getUserInfo();
        set((state: any) => ({
          googleDrive: {
            ...state.googleDrive,
            isAuthenticated: true,
            user: user ? {
              name: user.name,
              email: user.email,
              photo: user.imageUrl || undefined,
            } : null,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive:', error);
    }
  },
  
  signInToGoogleDrive: async () => {
    try {
      const driveService = GoogleDriveService.getInstance();
      await driveService.signIn();
      
      const user = await driveService.getUserInfo();
      set((state: any) => ({
        googleDrive: {
          ...state.googleDrive,
          isAuthenticated: true,
          user: user ? {
            name: user.name,
            email: user.email,
            photo: user.imageUrl || undefined,
          } : null,
        },
      }));
    } catch (error) {
      console.error('Failed to sign in to Google Drive:', error);
      set((state: any) => ({
        googleDrive: {
          ...state.googleDrive,
          syncStatus: 'error',
        },
      }));
    }
  },
  
  signOutFromGoogleDrive: async () => {
    try {
      const driveService = GoogleDriveService.getInstance();
      await driveService.signOut();
      
      set((state: any) => ({
        googleDrive: {
          ...state.googleDrive,
          isAuthenticated: false,
          user: null,
        },
      }));
    } catch (error) {
      console.error('Failed to sign out from Google Drive:', error);
    }
  },
  
  syncToGoogleDrive: async () => {
    const { vocabulary } = get();
    set((state: any) => ({
      googleDrive: {
        ...state.googleDrive,
        syncStatus: 'syncing',
      },
    }));

    try {
      const driveService = GoogleDriveService.getInstance();
      const result = await driveService.syncVocabulary(vocabulary);
      
      if (result.success) {
        set((state: any) => ({
          googleDrive: {
            ...state.googleDrive,
            syncStatus: 'success',
            lastSync: new Date().toISOString(),
          },
        }));
      } else {
        throw new Error(result.error || 'Sync failed');
      }

      // Reset status after 3 seconds
      setTimeout(() => {
        set((state: any) => ({
          googleDrive: {
            ...state.googleDrive,
            syncStatus: 'idle',
          },
        }));
      }, 3000);
    } catch (error) {
      console.error('Failed to sync to Google Drive:', error);
      set((state: any) => ({
        googleDrive: {
          ...state.googleDrive,
          syncStatus: 'error',
        },
      }));

      // Reset status after 3 seconds
      setTimeout(() => {
        set((state: any) => ({
          googleDrive: {
            ...state.googleDrive,
            syncStatus: 'idle',
          },
        }));
      }, 3000);
    }
  },
  
  setGoogleDriveAutoSync: (enabled: boolean) =>
    set((state: any) => ({
      googleDrive: {
        ...state.googleDrive,
        autoSync: enabled,
      },
    })),
});
