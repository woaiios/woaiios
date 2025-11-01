/**
 * Database Type Definitions
 * Clean type definitions for the dictionary database system
 */

export interface DatabaseMetadata {
  version: string;
  totalChunks: number;
  chunkCount: number;
  chunkSize: number;
  totalWords: number;
  baseUrl: string;
}

export interface ChunkData {
  chunkNumber: number;
  data: Uint8Array;
  timestamp: number;
  version: string;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  percent: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
  status: 'loading' | 'complete' | 'error';
  message?: string;
}

export interface WordDefinition {
  word: string;
  phonetic?: string;
  definition?: string;
  translation?: string;
  collins?: number;
  oxford?: number;
  tag?: string;
  bnc?: number;
  frq?: number;
  exchange?: string;  // Word forms: "p:past/d:done/i:doing/0:lemma"
}

export type ProgressCallback = (progress: LoadProgress) => void;
export type ChunkLoadedCallback = (chunkNumber: number) => void;
export type CompleteCallback = () => void;
export type ErrorCallback = (error: Error) => void;
