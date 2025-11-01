/**
 * StorageHelper
 * Provides an interface for asynchronous localStorage operations using a Web Worker
 * Falls back to synchronous localStorage if workers are not available
 */

import { WorkerBridge } from './WorkerBridge.js';

export class StorageHelper {
    constructor() {
        this.worker = null;
        this.useWorker = true;
        this.isInitialized = false;
    }

    /**
     * Initialize the storage helper
     * Attempts to use Web Worker, falls back to direct localStorage if unavailable
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        // Temporarily disable worker in dev mode due to Vite parsing issue
        // Worker will work in production build
        if (import.meta.env.DEV) {
            console.log('⚠️ Worker disabled in dev mode, using sync localStorage');
            this.useWorker = false;
            this.isInitialized = true;
            return;
        }

        // Check if Web Workers are supported
        if (typeof Worker === 'undefined') {
            console.warn('⚠️ Web Workers not supported, using synchronous localStorage');
            this.useWorker = false;
            this.isInitialized = true;
            return;
        }

        try {
            // Try to initialize worker
            // Worker file is in public folder to avoid Vite processing
            const workerPath = '/woaiios/workers/storage-worker.js';
            this.worker = new WorkerBridge(workerPath);
            await this.worker.initialize();
            console.log('✅ StorageHelper using Web Worker for async operations');
            this.isInitialized = true;
        } catch (error) {
            console.warn('⚠️ Failed to initialize storage worker, falling back to sync localStorage:', error);
            this.useWorker = false;
            this.isInitialized = true;
        }
    }

    /**
     * Get item from localStorage (async)
     * @param {string} key - Storage key
     * @returns {Promise<any>} - Parsed JSON value or null
     */
    async getItem(key) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.useWorker && this.worker) {
            try {
                return await this.worker.sendMessage('getItem', { key });
            } catch (error) {
                console.error('Worker getItem failed, falling back to sync:', error);
                return this._syncGetItem(key);
            }
        }

        return this._syncGetItem(key);
    }

    /**
     * Set item in localStorage (async)
     * @param {string} key - Storage key
     * @param {any} value - Value to store (will be JSON stringified)
     * @returns {Promise<boolean>} - Success status
     */
    async setItem(key, value) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.useWorker && this.worker) {
            try {
                return await this.worker.sendMessage('setItem', { key, value });
            } catch (error) {
                console.error('Worker setItem failed, falling back to sync:', error);
                return this._syncSetItem(key, value);
            }
        }

        return this._syncSetItem(key, value);
    }

    /**
     * Remove item from localStorage (async)
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} - Success status
     */
    async removeItem(key) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.useWorker && this.worker) {
            try {
                return await this.worker.sendMessage('removeItem', { key });
            } catch (error) {
                console.error('Worker removeItem failed, falling back to sync:', error);
                return this._syncRemoveItem(key);
            }
        }

        return this._syncRemoveItem(key);
    }

    /**
     * Terminate the worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    // Synchronous fallback methods

    _syncGetItem(key) {
        const value = localStorage.getItem(key);
        if (value === null) {
            return null;
        }
        try {
            return JSON.parse(value);
        } catch (error) {
            console.error(`Error parsing JSON for key "${key}":`, error);
            return null;
        }
    }

    _syncSetItem(key, value) {
        try {
            const jsonString = JSON.stringify(value);
            localStorage.setItem(key, jsonString);
            return true;
        } catch (error) {
            console.error(`Error setting item for key "${key}":`, error);
            return false;
        }
    }

    _syncRemoveItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing item for key "${key}":`, error);
            return false;
        }
    }
}

// Create and export a singleton instance
export const storageHelper = new StorageHelper();
