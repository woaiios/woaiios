/**
 * CacheManager - LRU Cache Implementation
 * Provides efficient in-memory caching with LRU eviction policy
 */
export class CacheManager {
    constructor(maxSize = 10000) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            total: 0
        };
    }

    /**
     * Get item from cache
     */
    get(key) {
        this.stats.total++;
        
        if (this.cache.has(key)) {
            this.stats.hits++;
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        
        this.stats.misses++;
        return null;
    }

    /**
     * Set item in cache with LRU eviction
     */
    set(key, value) {
        // If key exists, remove it first to re-insert at end
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        
        // Evict oldest entry if cache is full
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, value);
    }

    /**
     * Check if key exists in cache
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Clear all cached items
     */
    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, total: 0 };
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.stats.total > 0 
                ? ((this.stats.hits / this.stats.total) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Get current cache size
     */
    get size() {
        return this.cache.size;
    }
}
