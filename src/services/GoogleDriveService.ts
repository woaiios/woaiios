/**
 * GoogleDriveService - Google Drive 同步服务
 * Provides cloud synchronization for vocabulary data using Google Drive API
 */

export interface GoogleDriveStatus {
  isInitialized: boolean;
  isSignedIn: boolean;
  hasFile: boolean;
}

export interface UserInfo {
  name: string;
  email: string;
  imageUrl: string | null;
}

export interface SyncResult {
  success: boolean;
  action?: 'upload' | 'merge' | 'merge_fail';
  data?: any;
  error?: string;
}

export class GoogleDriveService {
  private static instance: GoogleDriveService | null = null;

  private clientId = '781460731280-7moak9c5fq75dubjlnmes4b4gdku3qvt.apps.googleusercontent.com';
  private scopes = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
  private isInitialized = false;
  private isSignedIn = false;
  private accessToken: string | null = null;
  private fileId: string | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.isSignedIn;
  }

  /**
   * Initialize Google Drive API
   */
  async initialize(): Promise<boolean> {
    try {
      await this.waitForGoogleIdentityServices();
      await this.loadGoogleAPIClient();
      this.isInitialized = true;
      console.log('Google Drive API initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google Drive API:', error);
      return false;
    }
  }

  /**
   * Sign in to Google account
   */
  async signIn(silent = false): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const tokenResponse = await this.getToken(silent);
      this.accessToken = tokenResponse.access_token;
      this.isSignedIn = true;
      
      await this.initializeGoogleAPIClient();
      await this.findOrCreateVocabularyFile();
      
      console.log('Successfully signed in to Google');
      return true;
    } catch (error) {
      console.error('Error signing in:', error);
      this.isSignedIn = false;
      return false;
    }
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<boolean> {
    try {
      if (this.accessToken && (window as any).google?.accounts) {
        (window as any).google.accounts.oauth2.revoke(this.accessToken);
      }
      this.isSignedIn = false;
      this.accessToken = null;
      this.fileId = null;
      console.log('Successfully signed out from Google');
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
      return false;
    }
  }

  /**
   * Upload vocabulary data to Google Drive
   */
  async uploadVocabulary(vocabularyData: any): Promise<boolean> {
    try {
      if (!this.isSignedIn || !this.fileId) {
        throw new Error('Not signed in or file not found');
      }

      const jsonData = JSON.stringify(vocabularyData, null, 2);
      
      await (window as any).gapi.client.request({
        path: `/upload/drive/v3/files/${this.fileId}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: jsonData
      });

      console.log('Vocabulary uploaded successfully to Google Drive');
      return true;
    } catch (error: any) {
      console.error('Error uploading vocabulary:', error);
      if (error.status === 403) {
        console.log('Attempting to refresh access token...');
        await this.refreshAccessToken();
        return this.uploadVocabulary(vocabularyData);
      }
      return false;
    }
  }

  /**
   * Download vocabulary data from Google Drive
   */
  async downloadVocabulary(): Promise<any | null> {
    if (!this.isSignedIn || !this.fileId) {
      throw new Error('Not signed in or file not found');
    }

    try {
      const response = await (window as any).gapi.client.drive.files.get({
        fileId: this.fileId,
        alt: 'media'
      });

      if (response.body) {
        console.log('Vocabulary downloaded successfully from Google Drive');
        return JSON.parse(response.body);
      }
      return null;
    } catch (error) {
      console.error('Error downloading vocabulary:', error);
      return null;
    }
  }

  /**
   * Sync vocabulary data (two-way merge)
   */
  async syncVocabulary(localData: any): Promise<SyncResult> {
    if (!this.isSignedIn) {
      return { success: false, error: 'Not signed in to Google' };
    }

    try {
      const remoteData = await this.downloadVocabulary();
      
      if (!remoteData || !remoteData.version) {
        console.log('No remote data found. Uploading local data.');
        const uploadSuccess = await this.uploadVocabulary(localData);
        return { success: uploadSuccess, action: 'upload', data: localData };
      }

      const mergedVocabulary = this.mergeVocabularies(localData, remoteData);
      const uploadSuccess = await this.uploadVocabulary(mergedVocabulary);

      return uploadSuccess
        ? { success: true, action: 'merge', data: mergedVocabulary }
        : { success: false, action: 'merge_fail', data: localData, error: 'Failed to upload merged vocabulary' };

    } catch (error: any) {
      console.error('Error syncing vocabulary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get authentication status
   */
  getAuthStatus(): GoogleDriveStatus {
    return {
      isInitialized: this.isInitialized,
      isSignedIn: this.isSignedIn,
      hasFile: !!this.fileId
    };
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<UserInfo | null> {
    if (!this.isSignedIn) return null;

    try {
      const response = await (window as any).gapi.client.people.people.get({
        resourceName: 'people/me',
        personFields: 'names,emailAddresses,photos',
      });

      const person = response.result;
      return {
        name: person.names?.[0]?.displayName || 'Google User',
        email: person.emailAddresses?.[0]?.value || '',
        imageUrl: person.photos?.[0]?.url || null,
      };
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  // Private helper methods

  private async findOrCreateVocabularyFile(): Promise<string | null> {
    try {
      let file = await this.findFileInSpace('drive');
      if (file) {
        this.fileId = file.id;
        console.log('Found existing vocabulary file in drive:', this.fileId);
        return this.fileId;
      }

      file = await this.findFileInSpace('appDataFolder');
      if (file) {
        this.fileId = file.id;
        console.warn('Found vocabulary file in hidden appDataFolder.');
        return this.fileId;
      }

      this.fileId = await this.createFile();
      console.log('Created new vocabulary file in root directory:', this.fileId);
      return this.fileId;
    } catch (error) {
      console.error('Error finding/creating vocabulary file:', error);
      return null;
    }
  }

  private async findFileInSpace(space: string): Promise<any> {
    const response = await (window as any).gapi.client.drive.files.list({
      q: "name='WordDiscoverer_Vocabulary.json' and trashed=false",
      spaces: space,
      fields: 'files(id, name)'
    });
    return response.result.files?.length > 0 ? response.result.files[0] : null;
  }

  private async createFile(): Promise<string> {
    const response = await (window as any).gapi.client.drive.files.create({
      resource: { name: 'WordDiscoverer_Vocabulary.json', parents: ['root'] },
      fields: 'id'
    });
    return response.result.id;
  }

  private getToken(silent = false): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: this.scopes,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description));
          } else {
            resolve(response);
          }
        },
      });
      client.requestAccessToken({ prompt: silent ? 'none' : '' });
    });
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const tokenResponse = await this.getToken(true);
      this.accessToken = tokenResponse.access_token;
      (window as any).gapi.client.setToken({ access_token: this.accessToken });
      console.log('Access token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.isSignedIn = false;
      return false;
    }
  }

  private waitForGoogleIdentityServices(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.accounts) return resolve();
      
      const timeout = setTimeout(() => {
        reject(new Error('Google Identity Services failed to load'));
      }, 10000);
      
      const interval = setInterval(() => {
        if ((window as any).google?.accounts) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  private loadGoogleAPIClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).gapi?.client) return resolve();
      
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        (window as any).gapi.load('client', resolve);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  private async initializeGoogleAPIClient(): Promise<void> {
    await (window as any).gapi.client.init({
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        'https://people.googleapis.com/$discovery/rest?version=v1'
      ]
    });
    (window as any).gapi.client.setToken({ access_token: this.accessToken });
  }

  private mergeVocabularies(localData: any, remoteData: any): any {
    console.log('Performing two-way merge for vocabulary');
    
    const localVocab = new Map(localData.vocabulary || []);
    const remoteVocab = new Map(remoteData.vocabulary || []);
    
    // Merge - local data takes priority
    const merged = new Map([...remoteVocab, ...localVocab]);
    
    return {
      version: '2.0',
      exportDate: new Date().toISOString(),
      vocabulary: Array.from(merged.entries()),
    };
  }
}

// Singleton instance
export const googleDriveService = new GoogleDriveService();
