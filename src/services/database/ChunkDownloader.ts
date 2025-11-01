import pako from 'pako';

/**
 * ChunkDownloader - Handles HTTP downloading and decompression of database chunks
 * Single responsibility: Download chunks from server with retry logic
 */
export class ChunkDownloader {
  private readonly baseUrl: string;
  private readonly maxRetries: number = 3;
  private readonly timeout: number = 30000; // 30 seconds

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '';
  }

  /**
   * Download all chunks with progress tracking
   */
  async downloadAllChunks(
    chunkUrls: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < chunkUrls.length; i++) {
      const url = `${this.baseUrl}/${chunkUrls[i]}`;
      const data = await this.downloadChunk(url);
      results.push(data);
      
      if (onProgress) {
        onProgress(i + 1, chunkUrls.length);
      }
    }
    
    return results;
  }

  /**
   * Download a single chunk with retry logic
   */
  private async downloadChunk(url: string): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const data = await this.fetchWithTimeout(url);
        return await this.decompressChunk(data);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`Failed to download chunk after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string): Promise<ArrayBuffer> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.arrayBuffer();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Decompress gzip data
   */
  private async decompressChunk(data: ArrayBuffer): Promise<any> {
    try {
      const decompressed = pako.ungzip(new Uint8Array(data), { to: 'string' });
      return JSON.parse(decompressed);
    } catch (error) {
      throw new Error(`Failed to decompress chunk: ${(error as Error).message}`);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
