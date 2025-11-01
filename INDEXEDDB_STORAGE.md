# IndexedDB Storage for Offline PWA

## Overview

The dictionary system now stores all word data directly in IndexedDB as raw data (not SQL files). This enables true offline functionality as a PWA application.

## Architecture

### Data Flow

1. **Initial Load**: SQL database file (`ecdict-top10k.db.gz`, ~2MB) is downloaded once
2. **Import Phase**: SQL data is parsed and imported into IndexedDB as raw word records
3. **Offline Queries**: All subsequent queries read directly from IndexedDB (no SQL needed)

### Components

#### DirectDataStorage (`src/services/DirectDataStorage.ts`)
- Manages IndexedDB for storing word data
- Memory cache for 10,000 most recent words
- Fast batch query support
- Stores raw word data with fields: word, phonetic, definition, translation, collins, bnc, frq, exchange, etc.

#### WordDatabase (`src/services/database/WordDatabase.ts`)
- Orchestrates database initialization
- Triggers one-time import from SQL to IndexedDB
- Query interface that prioritizes IndexedDB → SQL fallback → API fallback

#### TextAnalyzerService (`src/services/TextAnalyzerService.ts`)
- Uses WordDatabase for word lookups
- Leverages memory cache to avoid redundant queries
- Text analysis doesn't trigger re-queries if text unchanged

## Implementation Details

### IndexedDB Structure

**Object Store: `words`**
- Key: `word` (string, lowercase)
- Index: `word_lower` (for case-insensitive queries)
- Fields: word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio

**Object Store: `metadata`**
- Stores import status and statistics
- Key fields: importComplete, importDate, totalWords

### Import Process

```typescript
// WordDatabase initialization
await this.loader.load(); // Load SQL database
await this.directStorage.importFromDatabase(sqlDB); // Import to IndexedDB
```

**Import is performed once:**
- Checks `metadata.importComplete` flag
- If already imported, skips re-import
- Batch inserts 1000 words at a time
- Progress callback every 10,000 words
- Yields to main thread every 3,000 words to keep UI responsive

### Query Flow

```typescript
// Query priority:
1. Memory Cache (10K words, instant)
2. IndexedDB (fast, offline-capable)
3. SQL Database (fallback if IndexedDB import failed)
4. API (optional fallback for missing words)
```

## Performance

- **Initial Load**: ~2MB download (top 10K BNC words)
- **Import Time**: ~2-5 seconds for 10,000 words
- **Query Speed**: 
  - Memory cache: <1ms
  - IndexedDB: 1-5ms per word
  - Batch query: 300 words in <50ms

## Offline Capability

Once the initial import is complete:
- ✅ **No network required** for word lookups
- ✅ **No SQL.js library needed** at runtime (saved after import)
- ✅ **Persistent storage** via IndexedDB
- ✅ **Memory cache** prevents redundant queries
- ✅ **Service Worker** caches app shell and database file

## Cache Strategy

### Memory Cache (LRU)
- Max size: 10,000 words
- Evicts least recently used when full
- Shared across all text analysis sessions

### IndexedDB
- Persistent until manually cleared
- Survives browser restarts
- Shared across tabs/windows
- ~2-3MB storage for 10K words

## Usage

The system is fully automated:

```typescript
// Initialize (automatic on app load)
const analyzer = new TextAnalyzerService();

// First query triggers initialization and import
await analyzer.analyzeText(text, vocabulary);

// Subsequent queries use cached data
```

## Benefits vs SQL.js Approach

| Aspect | SQL.js | IndexedDB (Current) |
|--------|--------|---------------------|
| Runtime library | ~500KB | 0KB |
| Query language | SQL strings | Native JS |
| Offline capable | ❌ (needs SQL.js) | ✅ (pure IndexedDB) |
| Browser support | Good | Excellent |
| Performance | Moderate | Fast |
| Memory usage | High (in-memory DB) | Low (disk-backed) |
| PWA friendly | ❌ | ✅ |

## Troubleshooting

### Import Failed
- Check browser console for error messages
- Verify database file is accessible
- Clear IndexedDB and retry: `indexedDB.deleteDatabase('WordDiscovererDirectDB')`

### Slow Queries
- Check memory cache hit rate: `directStorage.getCacheStats()`
- Verify IndexedDB import completed: Check `metadata.importComplete`

### Data Corruption
- Delete and re-import: Clear browser data → Reload app
- Import will automatically retry on next load
