/**
 * GoogleDriveManager Module
 * Handles Google Drive API integration and OAuth authentication
 */
export class GoogleDriveManager {
    constructor() {
        this.clientId = '781460731280-7moak9c5fq75dubjlnmes4b4gdku3qvt.apps.googleusercontent.com';
        this.apiKey = ''; // API key not needed for OAuth flow
        this.discoveryDocs = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
        this.scopes = 'https://www.googleapis.com/auth/drive.file';
        this.isInitialized = false;
        this.isSignedIn = false;
        this.accessToken = null;
        this.fileId = null; // ID of the vocabulary file in Google Drive
    }

    /**
     * Initialize Google Drive API
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            // Load Google API script if not already loaded
            if (!window.gapi) {
                await this.loadGoogleAPI();
            }

            // Initialize gapi
            await new Promise((resolve, reject) => {
                gapi.load('client:auth2', {
                    callback: resolve,
                    onerror: reject
                });
            });

            // Initialize client
            await gapi.client.init({
                clientId: this.clientId,
                discoveryDocs: this.discoveryDocs,
                scope: this.scopes
            });

            this.isInitialized = true;
            
            // Check if user is already signed in
            const authInstance = gapi.auth2.getAuthInstance();
            this.isSignedIn = authInstance.isSignedIn.get();
            
            if (this.isSignedIn) {
                this.accessToken = authInstance.currentUser.get().getAuthResponse().access_token;
                await this.findOrCreateVocabularyFile();
            }

            console.log('Google Drive API initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive API:', error);
            return false;
        }
    }

    /**
     * Load Google API script
     * @returns {Promise<void>}
     */
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (document.querySelector('script[src*="apis.google.com/js/api.js"]')) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Sign in to Google
     * @returns {Promise<boolean>} Success status
     */
    async signIn() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const authInstance = gapi.auth2.getAuthInstance();
            const user = await authInstance.signIn();
            
            this.isSignedIn = true;
            this.accessToken = user.getAuthResponse().access_token;
            
            await this.findOrCreateVocabularyFile();
            
            console.log('Successfully signed in to Google');
            return true;
        } catch (error) {
            console.error('Error signing in:', error);
            return false;
        }
    }

    /**
     * Sign out from Google
     * @returns {Promise<boolean>} Success status
     */
    async signOut() {
        try {
            if (!this.isInitialized) return true;

            const authInstance = gapi.auth2.getAuthInstance();
            await authInstance.signOut();
            
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
     * Find existing vocabulary file or create a new one
     * @returns {Promise<string|null>} File ID or null
     */
    async findOrCreateVocabularyFile() {
        try {
            // Search for existing vocabulary file
            const response = await gapi.client.drive.files.list({
                q: "name='WordDiscoverer_Vocabulary.json' and trashed=false",
                fields: 'files(id, name, modifiedTime)'
            });

            if (response.result.files && response.result.files.length > 0) {
                this.fileId = response.result.files[0].id;
                console.log('Found existing vocabulary file:', this.fileId);
                return this.fileId;
            }

            // Create new file if not found
            const fileMetadata = {
                name: 'WordDiscoverer_Vocabulary.json',
                parents: ['appDataFolder'] // Store in app-specific folder
            };

            const createResponse = await gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });

            this.fileId = createResponse.result.id;
            console.log('Created new vocabulary file:', this.fileId);
            return this.fileId;
        } catch (error) {
            console.error('Error finding/creating vocabulary file:', error);
            return null;
        }
    }

    /**
     * Upload vocabulary data to Google Drive
     * @param {Object} vocabularyData - Vocabulary data to upload
     * @returns {Promise<boolean>} Success status
     */
    async uploadVocabulary(vocabularyData) {
        try {
            if (!this.isSignedIn || !this.fileId) {
                throw new Error('Not signed in or file not found');
            }

            const jsonData = JSON.stringify(vocabularyData, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify({
                name: 'WordDiscoverer_Vocabulary.json',
                parents: ['appDataFolder']
            })], { type: 'application/json' }));
            form.append('file', blob);

            const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            console.log('Vocabulary uploaded successfully to Google Drive');
            return true;
        } catch (error) {
            console.error('Error uploading vocabulary:', error);
            return false;
        }
    }

    /**
     * Download vocabulary data from Google Drive
     * @returns {Promise<Object|null>} Vocabulary data or null
     */
    async downloadVocabulary() {
        try {
            if (!this.isSignedIn || !this.fileId) {
                throw new Error('Not signed in or file not found');
            }

            const response = await gapi.client.drive.files.get({
                fileId: this.fileId,
                alt: 'media'
            });

            if (response.body) {
                const vocabularyData = JSON.parse(response.body);
                console.log('Vocabulary downloaded successfully from Google Drive');
                return vocabularyData;
            }

            return null;
        } catch (error) {
            console.error('Error downloading vocabulary:', error);
            return null;
        }
    }

    /**
     * Sync vocabulary with Google Drive
     * @param {Object} localVocabulary - Local vocabulary data
     * @returns {Promise<Object>} Sync result with status and data
     */
    async syncVocabulary(localVocabulary) {
        try {
            if (!this.isSignedIn) {
                return { success: false, error: 'Not signed in to Google' };
            }

            // Download remote data
            const remoteData = await this.downloadVocabulary();
            
            if (!remoteData) {
                // No remote data, upload local data
                const uploadSuccess = await this.uploadVocabulary(localVocabulary);
                return {
                    success: uploadSuccess,
                    action: 'upload',
                    data: localVocabulary,
                    error: uploadSuccess ? null : 'Failed to upload vocabulary'
                };
            }

            // Compare timestamps to determine sync strategy
            const localTimestamp = localVocabulary.exportDate || new Date().toISOString();
            const remoteTimestamp = remoteData.exportDate || new Date().toISOString();

            if (new Date(localTimestamp) > new Date(remoteTimestamp)) {
                // Local is newer, upload local data
                const uploadSuccess = await this.uploadVocabulary(localVocabulary);
                return {
                    success: uploadSuccess,
                    action: 'upload',
                    data: localVocabulary,
                    error: uploadSuccess ? null : 'Failed to upload vocabulary'
                };
            } else if (new Date(remoteTimestamp) > new Date(localTimestamp)) {
                // Remote is newer, return remote data for local update
                return {
                    success: true,
                    action: 'download',
                    data: remoteData,
                    error: null
                };
            } else {
                // Same timestamp, no sync needed
                return {
                    success: true,
                    action: 'none',
                    data: localVocabulary,
                    error: null
                };
            }
        } catch (error) {
            console.error('Error syncing vocabulary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get authentication status
     * @returns {Object} Auth status
     */
    getAuthStatus() {
        return {
            isInitialized: this.isInitialized,
            isSignedIn: this.isSignedIn,
            hasFile: !!this.fileId
        };
    }

    /**
     * Get user info
     * @returns {Object|null} User info or null
     */
    getUserInfo() {
        try {
            if (!this.isSignedIn || !this.isInitialized) {
                return null;
            }

            const authInstance = gapi.auth2.getAuthInstance();
            const user = authInstance.currentUser.get();
            const profile = user.getBasicProfile();

            return {
                name: profile.getName(),
                email: profile.getEmail(),
                imageUrl: profile.getImageUrl()
            };
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }

    /**
     * Check if Google Drive is available
     * @returns {boolean} Availability status
     */
    isAvailable() {
        return this.isInitialized && typeof gapi !== 'undefined';
    }
}
