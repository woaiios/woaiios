/**
 * WordDatabase Module (Refactored)
 * Handles progressive chunk loading (JSON format)
 * 
 * NOTE: This class should ONLY be used internally by DirectDataStorage
 */
import { ProgressiveDatabaseLoader } from '../ProgressiveDatabaseLoader.js';
import { CacheManager } from './CacheManager.js';
import { WordQueryService } from './WordQueryService.js';

export class WordDatabase {
    constructor() {
        this.isLoaded = false;
        this.progressiveLoader = null;
        this.progressCallback = null;
        
        // Query service components (no longer needed, but kept for compatibility)
        this.cache = new CacheManager(10000);
        this.queryService = null;
    }

    /**
     * Set progress callback
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Initialize database with progressive loading
     */
    async initialize() {
        try {
            console.log('🚀 Using progressive database loading (JSON format)...');
            
            // Initialize progressive loader (no SQL.js needed)
            this.progressiveLoader = new ProgressiveDatabaseLoader();
            this._registerLoaderEvents();
            
            await this.progressiveLoader.initialize();
            // Load only first chunk (~77k high-frequency words) for fast startup
            await this.progressiveLoader.loadPriorityChunks(1);
            
            console.log(`✅ Progressive loader initialized and first chunk loaded`);
            
            this.isLoaded = true;
            return true;
            
        } catch (error) {
            console.error('Error loading ECDICT database:', error);
            this.isLoaded = false;
            return false;
        }
    }

    /**
     * Register progressive loader events
     * @private
     */
    _registerLoaderEvents() {
        this.progressiveLoader.on('progress', (data) => {
            if (this.progressCallback) {
                this.progressCallback(data);
            }
        });
        
        this.progressiveLoader.on('chunkLoaded', (data) => {
            console.log(`✅ Chunk ${data.chunkNumber} loaded (${data.percentage.toFixed(1)}%)`);
        });
        
        this.progressiveLoader.on('complete', (data) => {
            console.log(`✨ Database fully loaded: ${data.totalWords.toLocaleString()} words`);
        });
        
        this.progressiveLoader.on('error', (error) => {
            console.error('Progressive loader error:', error);
        });
    }

    /**
     * Check if database is loaded
     */
    isDatabaseLoaded() {
        return this.isLoaded;
    }
}
