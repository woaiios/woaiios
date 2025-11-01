import initSqlJs, { Database } from 'sql.js';

/**
 * ChunkMerger - Merges downloaded chunks into a SQL database
 * Single responsibility: Combine chunks and create database
 */
export class ChunkMerger {
  /**
   * Merge multiple chunks into a single dataset
   */
  mergeChunks(chunks: any[]): any[] {
    const allWords: any[] = [];
    
    for (const chunk of chunks) {
      if (this.validateChunk(chunk)) {
        allWords.push(...chunk.words);
      }
    }
    
    return this.deduplicateWords(allWords);
  }

  /**
   * Create SQL.js database from merged data
   */
  async createDatabase(words: any[]): Promise<Database> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
    
    const db = new SQL.Database();
    
    // Create table
    db.run(`
      CREATE TABLE words (
        word TEXT PRIMARY KEY,
        phonetic TEXT,
        definition TEXT,
        translation TEXT,
        frequency INTEGER
      )
    `);
    
    // Insert words in batches
    const batchSize = 1000;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      this.insertBatch(db, batch);
    }
    
    return db;
  }

  /**
   * Insert a batch of words
   */
  private insertBatch(db: Database, words: any[]): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO words (word, phonetic, definition, translation, frequency)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    for (const word of words) {
      stmt.run([
        word.word || '',
        word.phonetic || '',
        word.definition || '',
        word.translation || '',
        word.frequency || 0
      ]);
    }
    
    stmt.free();
  }

  /**
   * Validate chunk structure
   */
  private validateChunk(chunk: any): boolean {
    return chunk && Array.isArray(chunk.words) && chunk.words.length > 0;
  }

  /**
   * Remove duplicate words (keep first occurrence)
   */
  private deduplicateWords(words: any[]): any[] {
    const seen = new Set<string>();
    return words.filter(word => {
      if (seen.has(word.word)) {
        return false;
      }
      seen.add(word.word);
      return true;
    });
  }
}
