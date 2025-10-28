/**
 * GoogleDriveManager Module
 * Handles Google Drive API integration and OAuth authentication using Google Identity Services (GIS)
 */
export class GoogleDriveManager {
    constructor() {
        this.clientId = '781460731280-7moak9c5fq75dubjlnmes4b4gdku3qvt.apps.googleusercontent.com';
        this.scopes = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
        this.isInitialized = false;
        this.isSignedIn = false;
        this.accessToken = null;
        this.fileId = null; // ID of the vocabulary file in Google Drive
        this.gapiLoaded = false;
    }

    async initialize() {
        try {
            await this._waitForGoogleIdentityServices();
            await this._loadGoogleAPIClient();
            this.isInitialized = true;
            console.log('Google Drive API initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive API:', error);
            return false;
        }
    }

    async signIn(silent = false) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            const tokenResponse = await this._getToken(silent);
            this.accessToken = tokenResponse.access_token;
            this.isSignedIn = true;
            await this._initializeGoogleAPIClient();
            await this.findOrCreateVocabularyFile();
            console.log('Successfully signed in to Google');
            return true;
        } catch (error) {
            console.error('Error signing in:', error);
            this.isSignedIn = false;
            return false;
        }
    }

    async signOut() {
        try {
            if (this.accessToken) {
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

    async findOrCreateVocabularyFile() {
        try {
            let file = await this._findFileInSpace('drive');
            if (file) {
                this.fileId = file.id;
                console.log('Found existing vocabulary file in drive:', this.fileId);
                return this.fileId;
            }

            file = await this._findFileInSpace('appDataFolder');
            if (file) {
                this.fileId = file.id;
                console.warn('Found vocabulary file in hidden appDataFolder.');
                return this.fileId;
            }

            this.fileId = await this._createFile();
            console.log('Created new vocabulary file in root directory:', this.fileId);
            return this.fileId;
        } catch (error) {
            console.error('Error finding/creating vocabulary file:', error);
            return null;
        }
    }

    async uploadVocabulary(vocabularyData) {
        try {
            if (!this.isSignedIn || !this.fileId) {
                throw new Error('Not signed in or file not found');
            }
            const jsonData = JSON.stringify(vocabularyData, null, 2);
            await gapi.client.request({
                path: `/upload/drive/v3/files/${this.fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': 'application/json' },
                body: jsonData
            });
            console.log('Vocabulary uploaded successfully to Google Drive');
            return true;
        } catch (error) {
            console.error('Error uploading vocabulary:', error);
            if (error.status === 403) {
                console.log('Attempting to refresh access token...');
                await this.refreshAccessToken();
                return this.uploadVocabulary(vocabularyData); // Retry
            }
            return false;
        }
    }

    async downloadVocabulary() {
        if (!this.isSignedIn || !this.fileId) {
            throw new Error('Not signed in or file not found');
        }
        try {
            const response = await gapi.client.drive.files.get({
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

    async syncVocabulary(localData) {
        if (!this.isSignedIn) {
            return { success: false, error: 'Not signed in to Google' };
        }
        try {
            const remoteData = await this.downloadVocabulary();
            if (!remoteData || !remoteData.version) {
                console.log('No remote data or old format found. Uploading local data.');
                const uploadSuccess = await this.uploadVocabulary(localData);
                return { success: uploadSuccess, action: 'upload', data: localData };
            }

            const mergedVocabulary = this._mergeVocabularies(localData, remoteData);
            const uploadSuccess = await this.uploadVocabulary(mergedVocabulary);

            return uploadSuccess
                ? { success: true, action: 'merge', data: mergedVocabulary }
                : { success: false, action: 'merge_fail', data: localData, error: 'Failed to upload merged vocabulary' };

        } catch (error) {
            console.error('Error syncing vocabulary:', error);
            return { success: false, error: error.message };
        }
    }

    getAuthStatus() {
        return { isInitialized: this.isInitialized, isSignedIn: this.isSignedIn, hasFile: !!this.fileId };
    }

    async getUserInfo() {
        if (!this.isSignedIn) return null;
        try {
            const response = await gapi.client.people.people.get({
                resourceName: 'people/me',
                personFields: 'names,emailAddresses,photos',
            });
            const person = response.result;
            return {
                name: person.names && person.names[0] ? person.names[0].displayName : 'Google User',
                email: person.emailAddresses && person.emailAddresses[0] ? person.emailAddresses[0].value : '',
                imageUrl: person.photos && person.photos[0] ? person.photos[0].url : null,
            };
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }

    // "Private" Helper Methods

    _getToken(silent = false) {
        return new Promise((resolve, reject) => {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: this.scopes,
                callback: (response) => response.error ? reject(new Error(response.error_description)) : resolve(response),
            });
            client.requestAccessToken({ prompt: silent ? 'none' : '' });
        });
    }

    async refreshAccessToken() {
        try {
            const tokenResponse = await this._getToken(true);
            this.accessToken = tokenResponse.access_token;
            gapi.client.setToken({ access_token: this.accessToken });
            console.log('Access token refreshed successfully');
            return true;
        } catch (error) {
            console.error('Token refresh error:', error);
            this.isSignedIn = false;
            return false;
        }
    }

    _waitForGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts) return resolve();
            const timeout = setTimeout(() => reject(new Error('Google Identity Services failed to load')), 10000);
            const interval = setInterval(() => {
                if (window.google && window.google.accounts) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    _loadGoogleAPIClient() {
        return new Promise((resolve, reject) => {
            if (window.gapi && window.gapi.client) return resolve();
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => gapi.load('client', resolve);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async _initializeGoogleAPIClient() {
        await gapi.client.init({
            discoveryDocs: [
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
                'https://people.googleapis.com/$discovery/rest?version=v1'
            ]
        });
        gapi.client.setToken({ access_token: this.accessToken });
    }

    async _findFileInSpace(space) {
        const response = await gapi.client.drive.files.list({
            q: "name='WordDiscoverer_Vocabulary.json' and trashed=false",
            spaces: space,
            fields: 'files(id, name)'
        });
        return response.result.files && response.result.files.length > 0 ? response.result.files[0] : null;
    }

    async _createFile() {
        const response = await gapi.client.drive.files.create({
            resource: { name: 'WordDiscoverer_Vocabulary.json', parents: ['root'] },
            fields: 'id'
        });
        return response.result.id;
    }

    _mergeVocabularies(localData, remoteData) {
        console.log('Performing two-way merge for vocabulary v2.0');
        const localLearning = new Map(localData.learningWords || []);
        const localMastered = new Map(localData.masteredWords || []);
        const remoteLearning = new Map(remoteData.learningWords || remoteData.vocabulary || []);
        const remoteMastered = new Map(remoteData.masteredWords || []);

        const mergedLearning = new Map([...remoteLearning, ...localLearning]);
        const mergedMastered = new Map([...remoteMastered, ...localMastered]);

        for (const word of localMastered.keys()) {
            if (mergedLearning.has(word)) mergedLearning.delete(word);
        }
        for (const word of localLearning.keys()) {
            if (mergedMastered.has(word)) mergedMastered.delete(word);
        }

        return {
            version: '2.0',
            exportDate: new Date().toISOString(),
            learningWords: Array.from(mergedLearning.entries()),
            masteredWords: Array.from(mergedMastered.entries()),
        };
    }
}