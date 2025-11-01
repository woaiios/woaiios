/**
 * WordDatabase
 * Main interface for dictionary word lookups
 */

import { ProgressiveDatabaseLoader, type LoaderConfig } from './ProgressiveDatabaseLoader';
import { DirectDataStorage } from '../DirectDataStorage';
import type { WordDefinition } from './DatabaseTypes';

export interface WordDatabaseConfig extends Omit<LoaderConfig, 'dbName'> {
  useDirectStorage?: boolean;
  fallbackToAPI?: boolean;
}

export class WordDatabase {
  private database: any | null = null;
  private directStorage: DirectDataStorage | null = null;
  private loader: ProgressiveDatabaseLoader | null = null;
  private initialized = false;
  private config: WordDatabaseConfig;

  constructor(config?: WordDatabaseConfig) {
    this.config = config || { chunkUrls: [] };
  }

  /**
   * Initialize database
   */
  async initialize(config?: WordDatabaseConfig): Promise<void> {
    if (this.initialized) return;

    const finalConfig = config || this.config;
    this.config = finalConfig;

    try {
      // Initialize direct storage if enabled
      if (finalConfig.useDirectStorage !== false) {
        this.directStorage = new DirectDataStorage('word-dictionary-direct');
        await this.directStorage.initialize();
      }

      // Load main database
      if (finalConfig.chunkUrls && finalConfig.chunkUrls.length > 0) {
        this.loader = new ProgressiveDatabaseLoader({
          ...finalConfig,
          dbName: 'word-dictionary',
          onComplete: (db) => {
            this.database = db;
            this.initialized = true;
          },
          onError: (error) => {
            console.error('Database initialization failed:', error);
            this.initialized = false;
          }
        });

        await this.loader.load();
      } else {
        // No chunks to load, rely on direct storage or API
        this.initialized = true;
      }

    } catch (error) {
      console.error('Failed to initialize WordDatabase:', error);
      throw error;
    }
  }

  /**
   * Query a single word
   */
  async query(word: string): Promise<WordDefinition | null> {
    if (!this.initialized) {
      throw new Error('WordDatabase not initialized');
    }

    const normalized = word.toLowerCase().trim();

    try {
      // Try direct storage first (fastest)
      if (this.directStorage) {
        const result = await this.directStorage.queryWord(normalized);
        if (result) {
          return this.formatWordData(result);
        }
      }

      // Try SQL database
      if (this.database) {
        const result = await this.queryDatabase(normalized);
        if (result) {
          return result;
        }
      }

      // Fallback to API if enabled
      if (this.config.fallbackToAPI) {
        return await this.queryAPI(normalized);
      }

      return null;

    } catch (error) {
      console.error(`Failed to query word "${word}":`, error);
      return null;
    }
  }

  /**
   * Query multiple words in batch
   */
  async batchQuery(words: string[]): Promise<Map<string, WordDefinition | null>> {
    const results = new Map<string, WordDefinition | null>();
    
    // Try direct storage batch query first
    if (this.directStorage && words.length > 10) {
      try {
        const storageResults = await this.directStorage.queryWordsBatch(words);
        for (const result of storageResults) {
          if (result.data) {
            results.set(result.word, this.formatWordData(result.data));
          }
        }
      } catch (error) {
        console.warn('Batch query from storage failed:', error);
      }
    }

    // Query remaining words individually
    for (const word of words) {
      if (!results.has(word)) {
        const result = await this.query(word);
        results.set(word, result);
      }
    }

    return results;
  }

  /**
   * Query from SQL database
   */
  private async queryDatabase(word: string): Promise<WordDefinition | null> {
    if (!this.database) return null;

    try {
      const stmt = this.database.prepare(
        'SELECT * FROM words WHERE word = ? LIMIT 1'
      );
      stmt.bind([word]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return this.formatWordData(row);
      }
      
      stmt.free();
      return null;
    } catch (error) {
      console.error('Database query failed:', error);
      return null;
    }
  }

  /**
   * Query from API (fallback)
   */
  private async queryAPI(word: string): Promise<WordDefinition | null> {
    // Placeholder for API fallback
    console.log(`API fallback for word: ${word}`);
    return null;
  }

  /**
   * Format word data to standard structure
   */
  private formatWordData(data: any): WordDefinition {
    return {
      word: String(data.word || ''),
      phonetic: String(data.phonetic || data.phonetics || ''),
      definition: String(data.definition || data.meanings || ''),
      translation: String(data.translation || data.translations || ''),
      collins: Number(data.collins || 0),
      oxford: Number(data.oxford || 0),
      tag: String(data.tag || ''),
      bnc: Number(data.bnc || 0),
      frq: Number(data.frq || 0)
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    if (this.loader) {
      await this.loader.clearCache();
    }
    if (this.directStorage) {
      await this.directStorage.clearData();
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
