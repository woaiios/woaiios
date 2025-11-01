/**
 * Storage Helper
 * Utility functions for localStorage and IndexedDB operations
 */

/**
 * Safely get item from localStorage with JSON parsing
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
}

/**
 * Safely set item to localStorage with JSON stringification
 */
export function setLocalStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Error writing to localStorage (${key}):`, error);
    return false;
  }
}

/**
 * Remove item from localStorage
 */
export function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Error removing from localStorage (${key}):`, error);
  }
}

/**
 * Clear all localStorage
 */
export function clearLocalStorage(): void {
  try {
    localStorage.clear();
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }
}

/**
 * Get localStorage size estimate in bytes
 */
export function getLocalStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return 'indexedDB' in window;
}

/**
 * Get IndexedDB database size estimate
 */
export async function getIndexedDBSize(_dbName?: string): Promise<number> {
  if (!isIndexedDBAvailable()) {
    return 0;
  }
  
  // Note: This is an estimate, not exact size
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
  } catch (error) {
    console.warn('Error estimating IndexedDB size:', error);
  }
  
  return 0;
}

/**
 * Delete IndexedDB database
 */
export async function deleteIndexedDB(dbName: string): Promise<boolean> {
  if (!isIndexedDBAvailable()) {
    return false;
  }
  
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => {
        console.warn(`IndexedDB deletion blocked for: ${dbName}`);
        resolve(false);
      };
    } catch (error) {
      console.error(`Error deleting IndexedDB (${dbName}):`, error);
      resolve(false);
    }
  });
}
