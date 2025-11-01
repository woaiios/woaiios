/**
 * DatabaseCache
 * Handles IndexedDB caching for database chunks
 * Small, focused module for cache operations
 */

import type { ChunkData, DatabaseMetadata } from './DatabaseTypes';

export class DatabaseCache {
  private dbName = 'WordDiscovererCache';
  private dbVersion = 1;
  private cacheDB: IDBDatabase | null = null;

  constructor(cacheName?: string) {
    if (cacheName) {
      this.dbName = cacheName;
    }
  }

  /**
   * Initialize IndexedDB cache
   */
  async initialize(): Promise<boolean> {
    try {
      this.cacheDB = await this.openDatabase();
      console.log('✅ Database cache initialized');
      return true;
    } catch (error) {
      console.warn('Failed to open cache, continuing without cache:', error);
      return false;
    }
  }

  /**
   * Open IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks', { keyPath: 'chunkNumber' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Save chunk to cache
   */
  async saveChunk(chunkNumber: number, data: ArrayBuffer | Uint8Array, version: string): Promise<void> {
    if (!this.cacheDB) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.cacheDB!.transaction(['chunks'], 'readwrite');
        const store = transaction.objectStore('chunks');

        const uint8Data = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

        const chunkData: ChunkData = {
          chunkNumber,
          data: uint8Data,
          timestamp: Date.now(),
          version
        };

        const request = store.put(chunkData);

        request.onsuccess = () => {
          console.log(`💾 Cached chunk ${chunkNumber}`);
          resolve();
        };
        request.onerror = () => {
          console.warn(`Failed to cache chunk ${chunkNumber}`);
          resolve(); // Don't fail if caching fails
        };
      } catch (error) {
        console.warn('Cache save error:', error);
        resolve();
      }
    });
  }

  /**
   * Load chunk from cache
   */
  async loadChunk(_dbName: string, chunkNumber: number, currentVersion?: string): Promise<Uint8Array | null> {
    if (!this.cacheDB) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.cacheDB!.transaction(['chunks'], 'readonly');
        const store = transaction.objectStore('chunks');
        const request = store.get(chunkNumber);

        request.onsuccess = () => {
          const result = request.result as ChunkData | undefined;
          if (result && (!currentVersion || result.version === currentVersion)) {
            console.log(`📦 Loaded chunk ${chunkNumber} from cache`);
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      } catch (error) {
        console.warn('Cache load error:', error);
        resolve(null);
      }
    });
  }

  /**
   * Save metadata
   */
  async saveMetadata(metadata: DatabaseMetadata): Promise<void> {
    if (!this.cacheDB) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.cacheDB!.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        const request = store.put({ key: 'metadata', ...metadata });

        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch (error) {
        resolve();
      }
    });
  }

  /**
   * Load metadata
   */
  async loadMetadata(_dbName?: string): Promise<DatabaseMetadata | null> {
    if (!this.cacheDB) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.cacheDB!.transaction(['metadata'], 'readonly');
        const store = transaction.objectStore('metadata');
        const request = store.get('metadata');

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            const { key, ...metadata } = result;
            resolve(metadata as DatabaseMetadata);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      } catch (error) {
        resolve(null);
      }
    });
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    if (!this.cacheDB) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.cacheDB!.transaction(['chunks', 'metadata'], 'readwrite');
        transaction.objectStore('chunks').clear();
        transaction.objectStore('metadata').clear();
        transaction.oncomplete = () => {
          console.log('🗑️ Cache cleared');
          resolve();
        };
        transaction.onerror = () => resolve();
      } catch (error) {
        resolve();
      }
    });
  }
}
