/**
 * GoogleDriveManager Module
 * Google Drive 管理器模块
 * 
 * 功能特性 (Features):
 * - Google Drive API 集成 (Google Drive API integration)
 * - OAuth 2.0 身份验证 (OAuth 2.0 authentication using Google Identity Services)
 * - 词汇数据云端同步 (Cloud vocabulary data synchronization)
 * - 自动合并本地和远程数据 (Auto-merge local and remote data)
 * - 访问令牌刷新机制 (Access token refresh mechanism)
 * 
 * @class GoogleDriveManager
 */
import { storageHelper } from './StorageHelper.js';

export class GoogleDriveManager {
    /**
     * 构造函数 - Constructor
     * 初始化 Google Drive 管理器配置 (Initialize Google Drive manager configuration)
     */
    constructor() {
        this.clientId = '781460731280-7moak9c5fq75dubjlnmes4b4gdku3qvt.apps.googleusercontent.com';
        // 请求的 OAuth 权限范围 (Requested OAuth permission scopes)
        this.scopes = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
        this.isInitialized = false;  // API 是否已初始化 (Whether API is initialized)
        this.isSignedIn = false;     // 用户是否已登录 (Whether user is signed in)
        this.accessToken = null;     // OAuth 访问令牌 (OAuth access token)
        this.fileId = null;          // Google Drive 中词汇文件的 ID (ID of vocabulary file in Google Drive)
        this.glossFileId = null;      // Google Drive 中释义缓存文件的 ID (ID of gloss cache file in Google Drive)
        this.gapiLoaded = false;     // GAPI 客户端是否已加载 (Whether GAPI client is loaded)

        // 持久化连接状态 (Persisted connection state)
        // wasConnected: 用户曾成功连接过 Google Drive（刷新后用于静默恢复）
        // isRestoring:  后台静默重连进行中
        // restoreFailed: 最近一次静默恢复失败（需要用户手动重新连接）
        this.persistKey = 'wordDiscovererGoogleDrive';
        this.wasConnected = false;
        this.isRestoring = false;
        this.restoreFailed = false;
        this.onAuthStateChange = null;  // UI 刷新回调 (UI refresh callback)
    }

    /**
     * 初始化 Google Drive API - Initialize Google Drive API
     * 加载必要的 Google 库和客户端 (Load necessary Google libraries and client)
     * @returns {Promise<boolean>} 初始化是否成功 (Whether initialization succeeded)
     */
    async initialize() {
        try {
            // 等待 Google Identity Services 加载 (Wait for Google Identity Services to load)
            await this._waitForGoogleIdentityServices();
            // 加载 Google API 客户端库 (Load Google API client library)
            await this._loadGoogleAPIClient();
            this.isInitialized = true;
            console.log('Google Drive API initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive API:', error);
            return false;
        }
    }

    /**
     * 登录 Google 账户 - Sign in to Google account
     * @param {boolean} silent - 是否静默登录（不显示弹窗）(Whether to sign in silently without popup)
     * @returns {Promise<boolean>} 登录是否成功 (Whether sign in succeeded)
     */
    async signIn(silent = false) {
        // 避免并发触发两次 OAuth 请求（后台静默恢复 + 用户手动点击）(Avoid concurrent OAuth requests)
        if (this._signInInFlight) {
            await this._signInInFlight.catch(() => { });
            if (this.isSignedIn) return true;
        }
        this._signInInFlight = this._doSignIn(silent);
        try {
            return await this._signInInFlight;
        } finally {
            this._signInInFlight = null;
        }
    }

    /**
     * 实际登录流程 - Actual sign-in flow
     * @param {boolean} silent - 是否静默登录（不显示弹窗）(Whether to sign in silently without popup)
     * @returns {Promise<boolean>} 登录是否成功 (Whether sign in succeeded)
     */
    async _doSignIn(silent) {
        try {
            if (!this.isInitialized) {
                const ok = await this.initialize();
                if (!ok) throw new Error('Google services unreachable (failed to load Google scripts)');
            }
            // 获取访问令牌 (Get access token)
            const tokenResponse = await this._getToken(silent);
            this.accessToken = tokenResponse.access_token;
            this.isSignedIn = true;
            // 初始化 GAPI 客户端 (Initialize GAPI client)
            await this._initializeGoogleAPIClient();
            // 查找或创建词汇文件 (Find or create vocabulary file)
            await this._withTimeout(
                this.findOrCreateVocabularyFile(),
                30000,
                'Drive file lookup timed out'
            );
            // 查找或创建释义缓存文件（失败不影响登录）(Find or create gloss cache file, best-effort)
            await this._withTimeout(
                this.findOrCreateGlossCacheFile(),
                30000,
                'Gloss cache file lookup timed out'
            ).catch((error) => {
                console.warn('⚠️ Gloss cache file lookup failed:', error);
            });
            // 持久化连接状态，刷新后可静默恢复 (Persist connection state for silent restore)
            this.wasConnected = true;
            await this._savePersisted({ connected: true });
            this._notifyAuthStateChange();
            console.log('Successfully signed in to Google');
            return true;
        } catch (error) {
            console.error('Error signing in:', error);
            this.isSignedIn = false;
            return false;
        }
    }

    /**
     * 退出登录 - Sign out
     * 撤销访问令牌并清除状态 (Revoke access token and clear state)
     * @returns {Promise<boolean>} 是否成功退出 (Whether sign out succeeded)
     */
    async signOut() {
        try {
            if (this.accessToken) {
                // 撤销访问令牌 (Revoke access token)
                window.google.accounts.oauth2.revoke(this.accessToken);
            }
            this.isSignedIn = false;
            this.accessToken = null;
            this.fileId = null;
            this.glossFileId = null;
            this.wasConnected = false;
            this.restoreFailed = false;
            await this._savePersisted({ connected: false });
            this._notifyAuthStateChange();
            console.log('Successfully signed out from Google');
            return true;
        } catch (error) {
            console.error('Error signing out:', error);
            return false;
        }
    }

    /**
     * 查找或创建词汇文件 - Find or create vocabulary file
     * 首先在用户 Drive 中查找，然后在 appDataFolder 中查找，最后创建新文件
     * (First search in user Drive, then in appDataFolder, finally create new file)
     * @returns {Promise<string|null>} 文件 ID (File ID)
     */
    async findOrCreateVocabularyFile() {
        try {
            // 在用户可见的 Drive 空间中查找 (Search in user-visible Drive space)
            let file = await this._findFileInSpace('drive');
            if (file) {
                this.fileId = file.id;
                console.log('Found existing vocabulary file in drive:', this.fileId);
                return this.fileId;
            }

            // 在隐藏的 appDataFolder 中查找 (Search in hidden appDataFolder)
            file = await this._findFileInSpace('appDataFolder');
            if (file) {
                this.fileId = file.id;
                console.warn('Found vocabulary file in hidden appDataFolder.');
                return this.fileId;
            }

            // 创建新文件 (Create new file)
            this.fileId = await this._createFile();
            console.log('Created new vocabulary file in root directory:', this.fileId);
            return this.fileId;
        } catch (error) {
            console.error('Error finding/creating vocabulary file:', error);
            return null;
        }
    }

    /**
     * 上传词汇数据到 Google Drive - Upload vocabulary data to Google Drive
     * @param {Object} vocabularyData - 词汇数据对象 (Vocabulary data object)
     * @returns {Promise<boolean>} 是否上传成功 (Whether upload succeeded)
     */
    async uploadVocabulary(vocabularyData) {
        try {
            if (!this.isSignedIn || !this.fileId) {
                throw new Error('Not signed in or file not found');
            }
            const success = await this._uploadFileContent(this.fileId, vocabularyData);
            if (success) console.log('Vocabulary uploaded successfully to Google Drive');
            return success;
        } catch (error) {
            console.error('Error uploading vocabulary:', error);
            return false;
        }
    }

    /**
     * 从 Google Drive 下载词汇数据 - Download vocabulary data from Google Drive
     * @returns {Promise<Object|null>} 词汇数据对象或 null (Vocabulary data object or null)
     */
    async downloadVocabulary() {
        if (!this.isSignedIn || !this.fileId) {
            throw new Error('Not signed in or file not found');
        }
        try {
            const data = await this._downloadFileContent(this.fileId);
            if (data) console.log('Vocabulary downloaded successfully from Google Drive');
            return data;
        } catch (error) {
            console.error('Error downloading vocabulary:', error);
            return null;
        }
    }

    /**
     * 同步词汇数据 - Sync vocabulary data
     * 执行本地和远程数据的双向合并 (Perform two-way merge of local and remote data)
     * @param {Object} localData - 本地词汇数据 (Local vocabulary data)
     * @returns {Promise<Object>} 同步结果 (Sync result)
     */
    async syncVocabulary(localData) {
        if (!this.isSignedIn) {
            return { success: false, error: 'Not signed in to Google' };
        }
        try {
            // 下载远程数据 (Download remote data)
            const remoteData = await this.downloadVocabulary();
            if (!remoteData || !remoteData.version) {
                // 如果没有远程数据，直接上传本地数据 (If no remote data, upload local data directly)
                console.log('No remote data or old format found. Uploading local data.');
                const uploadSuccess = await this.uploadVocabulary(localData);
                return { success: uploadSuccess, action: 'upload', data: localData };
            }

            // 合并本地和远程数据 (Merge local and remote data)
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

    /**
     * 恢复上次会话 - Restore previous session
     * 应用启动时调用：如果用户之前连接过 Google Drive，尝试静默重新登录 (prompt='none')
     * (Called at app startup: silently re-sign-in if user previously connected)
     * @returns {Promise<boolean>} 是否恢复成功 (Whether restore succeeded)
     */
    async restoreSession() {
        await this._loadPersisted();
        if (!this.wasConnected) {
            return false;
        }

        this.isRestoring = true;
        this.restoreFailed = false;
        this._notifyAuthStateChange();
        console.log('🔄 Restoring Google Drive session (silent sign-in)...');

        try {
            // 静默登录，不显示弹窗 (Silent sign-in without popup)
            const success = await this.signIn(true);
            this.restoreFailed = !success;
            if (success) {
                console.log('✅ Google Drive session restored');
            } else {
                console.warn('⚠️ Silent Google Drive restore failed, manual reconnect required');
            }
            return success;
        } catch (error) {
            console.warn('⚠️ Google Drive restore error:', error);
            this.restoreFailed = true;
            return false;
        } finally {
            this.isRestoring = false;
            this._notifyAuthStateChange();
        }
    }

    /**
     * 获取认证状态 - Get authentication status
     * @returns {Object} 包含初始化、登录和文件状态的对象 (Object containing init, sign-in, and file status)
     */
    getAuthStatus() {
        return {
            isInitialized: this.isInitialized,
            isSignedIn: this.isSignedIn,
            hasFile: !!this.fileId,
            wasConnected: this.wasConnected,
            isRestoring: this.isRestoring,
            restoreFailed: this.restoreFailed
        };
    }

    /**
     * 获取用户信息 - Get user information
     * 使用 People API 获取用户的姓名、邮箱和头像 (Use People API to get user's name, email, and photo)
     * @returns {Promise<Object|null>} 用户信息对象或 null (User info object or null)
     */
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

    // ==================== 私有辅助方法 (Private Helper Methods) ====================

    /**
     * 读取持久化的连接状态 (Load persisted connection state)
     * @returns {Promise<Object>} 持久化状态对象 (Persisted state object)
     * @private
     */
    async _loadPersisted() {
        const persisted = await storageHelper.getItem(this.persistKey);
        this._persisted = persisted && typeof persisted === 'object' ? persisted : {};
        this.wasConnected = this._persisted.connected === true;
        return this._persisted;
    }

    /**
     * 保存持久化的连接状态 (Save persisted connection state)
     * @param {Object} patch - 要合并的字段 (Fields to merge)
     * @returns {Promise<boolean>} 是否保存成功 (Whether save succeeded)
     * @private
     */
    async _savePersisted(patch) {
        if (!this._persisted) {
            await this._loadPersisted();
        }
        this._persisted = { ...this._persisted, ...patch };
        return storageHelper.setItem(this.persistKey, this._persisted);
    }

    /**
     * 通知 UI 认证状态变化 (Notify UI of auth state change)
     * @private
     */
    _notifyAuthStateChange() {
        if (typeof this.onAuthStateChange === 'function') {
            try {
                this.onAuthStateChange();
            } catch (error) {
                console.error('Error in auth state change callback:', error);
            }
        }
    }

    /**
     * 获取访问令牌 - Get access token
     * 使用 Google Identity Services 的 OAuth 2.0 流程 (Use Google Identity Services OAuth 2.0 flow)
     * @param {boolean} silent - 是否静默获取（不显示弹窗）(Whether to get silently without popup)
     * @returns {Promise<Object>} 包含访问令牌的响应对象 (Response object containing access token)
     */
    _getToken(silent = false) {
        return new Promise((resolve, reject) => {
            if (!window.google?.accounts?.oauth2) {
                reject(new Error('Google Identity Services not loaded (check network access to google.com)'));
                return;
            }
            // 超时兜底：弹窗被拦截/无响应时 callback 可能永远不触发
            // (Timeout fallback: callback may never fire if popup is blocked or unresponsive)
            const timeoutMs = silent ? 20000 : 120000;
            const timeout = setTimeout(() => {
                reject(new Error(silent ? 'Silent token request timed out' : 'Sign-in timed out (popup blocked?)'));
            }, timeoutMs);
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: this.scopes,
                callback: (response) => {
                    clearTimeout(timeout);
                    response.error ? reject(new Error(response.error_description || response.error)) : resolve(response);
                },
                // 弹窗打开失败等非 OAuth 错误 (Non-OAuth errors like popup failure to open)
                error_callback: (error) => {
                    clearTimeout(timeout);
                    reject(new Error(error?.type || 'popup_failed_to_open'));
                }
            });
            // prompt='none' 用于静默刷新 (prompt='none' for silent refresh)
            client.requestAccessToken({ prompt: silent ? 'none' : '' });
        });
    }

    /**
     * 刷新访问令牌 - Refresh access token
     * 当令牌过期时自动刷新 (Auto refresh when token expires)
     * @returns {Promise<boolean>} 是否刷新成功 (Whether refresh succeeded)
     */
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

    /**
     * 等待 Google Identity Services 加载 - Wait for Google Identity Services to load
     * 轮询检查 Google 库是否已加载，最多等待 10 秒 (Poll to check if Google library is loaded, wait up to 10 seconds)
     * @returns {Promise<void>}
     */

    _waitForGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            // 如果已经加载，立即返回 (If already loaded, return immediately)
            if (window.google && window.google.accounts) return resolve();
            // 10 秒后超时 (Timeout after 10 seconds)
            const timeout = setTimeout(() => reject(new Error('Google Identity Services failed to load')), 10000);
            // 每 100ms 检查一次 (Check every 100ms)
            const interval = setInterval(() => {
                if (window.google && window.google.accounts) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * 加载 Google API 客户端库 - Load Google API client library
     * 动态加载 gapi 库并初始化客户端 (Dynamically load gapi library and initialize client)
     * @returns {Promise<void>}
     */
    _loadGoogleAPIClient() {
        return new Promise((resolve, reject) => {
            // 如果已经加载，立即返回 (If already loaded, return immediately)
            if (window.gapi && window.gapi.client) return resolve();
            // 加载超时兜底：script 标签本身没有超时机制 (Load timeout: script tags have no built-in timeout)
            const timeout = setTimeout(() => reject(new Error('Google API client failed to load (timeout)')), 15000);
            // 动态创建 script 标签加载库 (Dynamically create script tag to load library)
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => gapi.load('client', () => {
                clearTimeout(timeout);
                resolve();
            });
            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Google API client failed to load (network blocked?)'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * 初始化 Google API 客户端 - Initialize Google API client
     * 加载 Drive 和 People API 的发现文档 (Load discovery documents for Drive and People APIs)
     * @returns {Promise<void>}
     */
    async _initializeGoogleAPIClient() {
        // 发现文档拉取无内置超时，网络不通时会无限挂起 (Discovery doc fetch has no timeout; hangs if unreachable)
        await this._withTimeout(
            gapi.client.init({
                discoveryDocs: [
                    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',  // Drive API v3
                    'https://people.googleapis.com/$discovery/rest?version=v1'      // People API v1
                ]
            }),
            15000,
            'Google API discovery docs timed out (network blocked?)'
        );
        // 设置访问令牌 (Set access token)
        gapi.client.setToken({ access_token: this.accessToken });
    }

    /**
     * 给 Promise 加超时 (Race a promise against a timeout)
     * @param {Promise} promise - 要限制的 Promise (Promise to limit)
     * @param {number} ms - 超时毫秒数 (Timeout in milliseconds)
     * @param {string} label - 超时错误信息 (Timeout error message)
     * @returns {Promise} 同结果的 Promise 或超时拒绝 (Same-result promise or timeout rejection)
     * @private
     */
    _withTimeout(promise, ms, label) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(label || 'Operation timed out')), ms);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    /**
     * 在指定空间查找文件 - Find file in specified space
     * @param {string} space - 搜索空间 ('drive' 或 'appDataFolder') (Search space: 'drive' or 'appDataFolder')
     * @param {string} [name='WordDiscoverer_Vocabulary.json'] - 文件名 (File name)
     * @returns {Promise<Object|null>} 文件对象或 null (File object or null)
     */
    async _findFileInSpace(space, name = 'WordDiscoverer_Vocabulary.json') {
        const response = await gapi.client.drive.files.list({
            q: `name='${name}' and trashed=false`,  // 查询条件 (Query condition)
            spaces: space,
            fields: 'files(id, name)'  // 只返回 ID 和名称字段 (Only return id and name fields)
        });
        return response.result.files && response.result.files.length > 0 ? response.result.files[0] : null;
    }

    /**
     * 创建新文件 - Create new file
     * 在用户 Drive 根目录创建文件 (Create file in user's Drive root directory)
     * @param {string} [name='WordDiscoverer_Vocabulary.json'] - 文件名 (File name)
     * @returns {Promise<string>} 新文件的 ID (ID of new file)
     */
    async _createFile(name = 'WordDiscoverer_Vocabulary.json') {
        const response = await gapi.client.drive.files.create({
            resource: { name: name, parents: ['root'] },
            fields: 'id'
        });
        return response.result.id;
    }

    /**
     * 通用文件内容上传 - Upload JSON content to a Drive file
     * @param {string} fileId - 目标文件 ID (Target file ID)
     * @param {Object} data - 要序列化上传的数据 (Data to serialize and upload)
     * @returns {Promise<boolean>} 是否成功 (Whether upload succeeded)
     * @private
     */
    async _uploadFileContent(fileId, data) {
        try {
            if (!this.isSignedIn || !fileId) {
                throw new Error('Not signed in or file not found');
            }
            const jsonData = JSON.stringify(data, null, 2);
            await gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': 'application/json' },
                body: jsonData
            });
            return true;
        } catch (error) {
            // 如果遇到 403 错误，尝试刷新令牌后重试 (If 403 error, refresh token and retry)
            if (error.status === 403) {
                console.log('Attempting to refresh access token...');
                await this.refreshAccessToken();
                return this._uploadFileContent(fileId, data); // Retry
            }
            throw error;
        }
    }

    /**
     * 通用文件内容下载 - Download and parse JSON content from a Drive file
     * @param {string} fileId - 源文件 ID (Source file ID)
     * @returns {Promise<Object|null>} 解析后的对象或 null (Parsed object or null)
     * @private
     */
    async _downloadFileContent(fileId) {
        if (!this.isSignedIn || !fileId) {
            throw new Error('Not signed in or file not found');
        }
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'  // 获取文件内容而不是元数据 (Get file content instead of metadata)
        });
        if (response.body) {
            return JSON.parse(response.body);
        }
        return null;
    }

    // ==================== 释义缓存同步 (Gloss Cache Sync) ====================

    /**
     * 查找或创建释义缓存文件 - Find or create the gloss cache file
     * 文件名: WordDiscoverer_GlossCache.json (File name: WordDiscoverer_GlossCache.json)
     * @returns {Promise<string|null>} 文件 ID (File ID)
     */
    async findOrCreateGlossCacheFile() {
        try {
            let file = await this._findFileInSpace('drive', 'WordDiscoverer_GlossCache.json');
            if (file) {
                this.glossFileId = file.id;
                return this.glossFileId;
            }

            file = await this._findFileInSpace('appDataFolder', 'WordDiscoverer_GlossCache.json');
            if (file) {
                this.glossFileId = file.id;
                console.warn('Found gloss cache file in hidden appDataFolder.');
                return this.glossFileId;
            }

            this.glossFileId = await this._createFile('WordDiscoverer_GlossCache.json');
            console.log('Created new gloss cache file in root directory:', this.glossFileId);
            return this.glossFileId;
        } catch (error) {
            console.error('Error finding/creating gloss cache file:', error);
            return null;
        }
    }

    /**
     * 上传释义缓存到 Google Drive - Upload gloss cache to Google Drive
     * @param {Object} cacheData - 缓存数据对象 (Cache data object)
     * @returns {Promise<boolean>} 是否上传成功 (Whether upload succeeded)
     */
    async uploadGlossCache(cacheData) {
        try {
            if (!this.glossFileId) {
                await this.findOrCreateGlossCacheFile();
            }
            const success = await this._uploadFileContent(this.glossFileId, cacheData);
            if (success) console.log('Gloss cache uploaded successfully to Google Drive');
            return success;
        } catch (error) {
            console.error('Error uploading gloss cache:', error);
            return false;
        }
    }

    /**
     * 从 Google Drive 下载释义缓存 - Download gloss cache from Google Drive
     * @returns {Promise<Object|null>} 缓存数据对象或 null (Cache data object or null)
     */
    async downloadGlossCache() {
        if (!this.glossFileId) {
            await this.findOrCreateGlossCacheFile();
        }
        if (!this.glossFileId) return null;
        try {
            return await this._downloadFileContent(this.glossFileId);
        } catch (error) {
            console.error('Error downloading gloss cache:', error);
            return null;
        }
    }

    /**
     * 同步释义缓存 - Sync gloss cache
     * 双向 union 合并：本地 + 远程条目取并集，冲突保留时间戳更新的
     * (Two-way union merge: union of entries, conflicts resolved by newest timestamp)
     * @param {Object} localData - 本地缓存数据 (Local cache data)
     * @returns {Promise<Object>} 同步结果 (Sync result)
     */
    async syncGlossCache(localData) {
        if (!this.isSignedIn) {
            return { success: false, error: 'Not signed in to Google' };
        }
        try {
            const remoteData = await this.downloadGlossCache();
            if (!remoteData || !Array.isArray(remoteData.entries)) {
                // 没有远程数据，直接上传本地缓存 (No remote data, upload local directly)
                const uploadSuccess = await this.uploadGlossCache(localData);
                return { success: uploadSuccess, action: 'upload', data: localData };
            }

            const merged = this._mergeGlossCaches(localData, remoteData);
            const uploadSuccess = await this.uploadGlossCache(merged);
            return uploadSuccess
                ? { success: true, action: 'merge', data: merged }
                : { success: false, action: 'merge_fail', data: localData, error: 'Failed to upload merged gloss cache' };
        } catch (error) {
            console.error('Error syncing gloss cache:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 合并释义缓存 - Merge gloss caches (union, newest wins)
     * @param {Object} localData - 本地数据 (Local data)
     * @param {Object} remoteData - 远程数据 (Remote data)
     * @returns {Object} 合并后的数据 (Merged data)
     * @private
     */
    _mergeGlossCaches(localData, remoteData) {
        const merged = new Map(remoteData.entries || []);
        for (const [key, value] of (localData.entries || [])) {
            const existing = merged.get(key);
            if (!existing || (Number(value?.t) || 0) > (Number(existing?.t) || 0)) {
                merged.set(key, value);
            }
        }
        return {
            version: '1.0',
            updatedAt: new Date().toISOString(),
            entries: Array.from(merged.entries())
        };
    }

    /**
     * 合并本地和远程词汇数据 - Merge local and remote vocabulary data
     * 执行双向合并，优先保留本地更改 (Perform two-way merge, prioritize local changes)
     * @param {Object} localData - 本地数据 (Local data)
     * @param {Object} remoteData - 远程数据 (Remote data)
     * @returns {Object} 合并后的数据 (Merged data)
     */
    _mergeVocabularies(localData, remoteData) {
        console.log('Performing two-way merge for vocabulary v2.0');
        // 转换为 Map 以便合并 (Convert to Map for merging)
        const localLearning = new Map(localData.learningWords || []);
        const localMastered = new Map(localData.masteredWords || []);
        // 兼容旧版本数据格式 (Compatible with old data format)
        const remoteLearning = new Map(remoteData.learningWords || remoteData.vocabulary || []);
        const remoteMastered = new Map(remoteData.masteredWords || []);

        // 合并数据，本地数据优先 (Merge data, local data takes priority)
        const mergedLearning = new Map([...remoteLearning, ...localLearning]);
        const mergedMastered = new Map([...remoteMastered, ...localMastered]);

        // 确保已掌握的单词不在学习列表中 (Ensure mastered words are not in learning list)
        for (const word of localMastered.keys()) {
            if (mergedLearning.has(word)) mergedLearning.delete(word);
        }
        // 确保正在学习的单词不在已掌握列表中 (Ensure learning words are not in mastered list)
        for (const word of localLearning.keys()) {
            if (mergedMastered.has(word)) mergedMastered.delete(word);
        }

        // 返回合并后的数据 (Return merged data)
        return {
            version: '2.0',
            exportDate: new Date().toISOString(),
            learningWords: Array.from(mergedLearning.entries()),
            masteredWords: Array.from(mergedMastered.entries()),
        };
    }
}