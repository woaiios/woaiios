/**
 * GoogleDriveManager Module
 * Handles Google Drive API integration and OAuth authentication using Google Identity Services (GIS)
 */
export class GoogleDriveManager {
    constructor() {
        this.clientId = '781460731280-7moak9c5fq75dubjlnmes4b4gdku3qvt.apps.googleusercontent.com';
        this.scopes = 'https://www.googleapis.com/auth/drive.file';
        this.isInitialized = false;
        this.isSignedIn = false;
        this.accessToken = null;
        this.fileId = null; // ID of the vocabulary file in Google Drive
        this.gapiLoaded = false;
    }

    /**
     * Initialize Google Drive API
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            // Wait for Google Identity Services to load
            await this.waitForGoogleIdentityServices();
            
            // Load Google API client library
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
     * Wait for Google Identity Services to load
     * @returns {Promise<void>}
     */
    waitForGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts) {
                resolve();
                return;
            }

            const checkInterval = setInterval(() => {
                if (window.google && window.google.accounts) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Google Identity Services failed to load'));
            }, 10000);
        });
    }

    /**
     * Load Google API client library
     * @returns {Promise<void>}
     */
    loadGoogleAPIClient() {
        return new Promise((resolve, reject) => {
            if (this.gapiLoaded) {
                resolve();
                return;
            }

            if (window.gapi) {
                this.gapiLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                this.gapiLoaded = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Sign in to Google using Google Identity Services
     * @returns {Promise<boolean>} Success status
     */
    async signIn() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            return new Promise((resolve, reject) => {
                // Use Google Identity Services for authentication
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: this.scopes,
                    callback: (response) => {
                        if (response.error) {
                            console.error('OAuth error:', response.error);
                            reject(new Error(response.error));
                            return;
                        }
                        
                        this.accessToken = response.access_token;
                        this.isSignedIn = true;
                        
                        // Initialize Google API client with the access token
                        this.initializeGoogleAPIClient().then(() => {
                            this.findOrCreateVocabularyFile().then(() => {
                                console.log('Successfully signed in to Google');
                                resolve(true);
                            });
                        }).catch(reject);
                    }
                });

                // Request access token
                client.requestAccessToken();
            });
        } catch (error) {
            console.error('Error signing in:', error);
            return false;
        }
    }

    /**
     * Initialize Google API client with access token
     * @returns {Promise<void>}
     */
    async initializeGoogleAPIClient() {
        return new Promise((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                    });

                    // Set the access token
                    gapi.client.setToken({ access_token: this.accessToken });
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Sign out from Google
     * @returns {Promise<boolean>} Success status
     */
    async signOut() {
        try {
            if (window.google && window.google.accounts) {
                window.google.accounts.oauth2.revoke(this.accessToken);
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
            if (!this.isSignedIn) {
                return null;
            }

            // For now, return basic info - in a real implementation,
            // you might want to make an API call to get user profile
            return {
                name: 'Google User',
                email: 'user@example.com',
                imageUrl: null
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