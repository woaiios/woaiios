/**
 * IndexedDBAdapter - IndexedDB Operations
 * Handles all IndexedDB interactions for word storage
 */
export class IndexedDBAdapter {
    constructor(dbName = 'WordDiscovererDirectDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    /**
     * Initialize IndexedDB
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ IndexedDB initialized');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create words store
                if (!db.objectStoreNames.contains('words')) {
                    const wordStore = db.createObjectStore('words', { keyPath: 'word' });
                    wordStore.createIndex('word_lower', 'word_lower', { unique: false });
                }
                
                // Create metadata store
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Query single word
     */
    async queryWord(word) {
        if (!this.db) return null;

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['words'], 'readonly');
                const store = transaction.objectStore('words');
                const index = store.index('word_lower');
                const request = index.get(word.toLowerCase());

                request.onsuccess = (event) => {
                    resolve(event.target.result || null);
                };

                request.onerror = () => {
                    console.error('Error querying word:', word);
                    resolve(null);
                };
            } catch (error) {
                console.error('Error in queryWord:', error);
                resolve(null);
            }
        });
    }

    /**
     * Batch query words
     */
    async queryWordsBatch(words) {
        if (!this.db) return [];

        const transaction = this.db.transaction(['words'], 'readonly');
        const store = transaction.objectStore('words');
        const index = store.index('word_lower');

        const promises = words.map(word => {
            return new Promise((resolve) => {
                const request = index.get(word.toLowerCase());
                request.onsuccess = (event) => {
                    const data = event.target.result;
                    resolve({ word, data: data || null });
                };
                request.onerror = () => resolve({ word, data: null });
            });
        });

        return await Promise.all(promises);
    }

    /**
     * Batch insert words
     */
    async insertWordsBatch(words) {
        if (!this.db) return false;

        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');

        for (const wordData of words) {
            store.put({
                ...wordData,
                word_lower: wordData.word.toLowerCase()
            });
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Set metadata
     */
    async setMetadata(key, value) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get metadata
     */
    async getMetadata(key) {
        if (!this.db) return null;

        return new Promise((resolve) => {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.get(key);
            
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result ? result.value : null);
            };
            request.onerror = () => resolve(null);
        });
    }

    /**
     * Clear all data
     */
    async clearAll() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words', 'metadata'], 'readwrite');
            
            transaction.objectStore('words').clear();
            transaction.objectStore('metadata').clear();
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Close database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Check if initialized
     */
    isInitialized() {
        return this.db !== null;
    }
}
