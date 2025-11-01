/**
 * ProgressiveDatabaseLoader
 * Orchestrates the progressive loading of dictionary database
 */

import { DatabaseCache } from './DatabaseCache';
import { ChunkDownloader } from './ChunkDownloader';
import { ChunkMerger } from './ChunkMerger';
import type { DatabaseMetadata, LoadProgress } from './DatabaseTypes';

export interface LoaderConfig {
  chunkUrls: string[];
  dbName: string;
  cacheName?: string;
  onProgress?: (progress: LoadProgress) => void;
  onComplete?: (db: any) => void;
  onError?: (error: Error) => void;
}

export class ProgressiveDatabaseLoader {
  private cache: DatabaseCache;
  private downloader: ChunkDownloader;
  private merger: ChunkMerger;
  private config: LoaderConfig;

  constructor(config: LoaderConfig) {
    this.config = config;
    this.cache = new DatabaseCache(config.cacheName || 'word-dictionary-cache');
    this.downloader = new ChunkDownloader();
    this.merger = new ChunkMerger();
  }

  /**
   * Load database progressively
   */
  async load(): Promise<any> {
    try {
      // Check if database is cached
      const metadata = await this.cache.loadMetadata(this.config.dbName);
      
      if (metadata && metadata.version) {
        // Try to load from cache
        const cachedDb = await this.loadFromCache(metadata);
        if (cachedDb) {
          this.emitProgress(100, 'Loaded from cache');
          this.config.onComplete?.(cachedDb);
          return cachedDb;
        }
      }

      // Download and build database
      const db = await this.downloadAndBuild();
      this.config.onComplete?.(db);
      return db;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError?.(err);
      throw err;
    }
  }

  /**
   * Load database from cache
   */
  private async loadFromCache(metadata: DatabaseMetadata): Promise<any | null> {
    try {
      this.emitProgress(10, 'Loading from cache...');

      const chunks = [];
      for (let i = 0; i < metadata.chunkCount; i++) {
        const chunk = await this.cache.loadChunk(this.config.dbName, i);
        if (!chunk) {
          return null; // Cache incomplete
        }
        chunks.push(chunk);
      }

      this.emitProgress(50, 'Merging cached data...');
      const db = this.merger.createDatabase(this.merger.mergeChunks(chunks));
      
      return db;
    } catch (error) {
      console.warn('Failed to load from cache:', error);
      return null;
    }
  }

  /**
   * Download and build database
   */
  private async downloadAndBuild(): Promise<any> {
    const { chunkUrls } = this.config;
    
    this.emitProgress(0, 'Starting download...');

    // Download all chunks with progress tracking
    const chunks = await this.downloader.downloadAllChunks(
      chunkUrls,
      (chunkIndex, total) => {
        const percent = Math.floor((chunkIndex / total) * 80);
        this.emitProgress(percent, `Downloading ${chunkIndex}/${total} chunks...`);
      }
    );

    this.emitProgress(85, 'Merging chunks...');

    // Merge chunks into database
    const mergedData = this.merger.mergeChunks(chunks);
    const db = this.merger.createDatabase(mergedData);

    this.emitProgress(90, 'Caching for offline use...');

    // Cache for future use
    await this.cacheDatabase(chunks);

    this.emitProgress(100, 'Complete!');

    return db;
  }

  /**
   * Cache database for offline use
   */
  private async cacheDatabase(chunks: any[]): Promise<void> {
    try {
      const metadata: DatabaseMetadata = {
        version: '1.0',
        chunkCount: chunks.length,
        totalWords: chunks.reduce((sum, chunk) => sum + (chunk.data?.length || 0), 0),
        lastUpdated: Date.now()
      };

      await this.cache.saveMetadata(this.config.dbName, metadata);

      for (let i = 0; i < chunks.length; i++) {
        await this.cache.saveChunk(this.config.dbName, i, chunks[i]);
      }
    } catch (error) {
      console.warn('Failed to cache database:', error);
      // Non-fatal, continue
    }
  }

  /**
   * Clear cached database
   */
  async clearCache(): Promise<void> {
    await this.cache.clearCache(this.config.dbName);
  }

  /**
   * Emit progress update
   */
  private emitProgress(percent: number, message: string): void {
    this.config.onProgress?.({
      percent,
      message,
      stage: this.getStage(percent)
    });
  }

  /**
   * Get loading stage based on percent
   */
  private getStage(percent: number): 'downloading' | 'processing' | 'caching' | 'complete' {
    if (percent < 80) return 'downloading';
    if (percent < 90) return 'processing';
    if (percent < 100) return 'caching';
    return 'complete';
  }

  /**
   * Cancel ongoing download (if supported)
   */
  cancel(): void {
    // Implementation depends on abort controller support
    console.log('Cancel requested');
  }
}
