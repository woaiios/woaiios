# Missing Features Implementation Plan

## Critical Features to Restore

Based on user feedback, the following features from the original vanilla JS version are missing:

### 1. Complete Dictionary System (HIGH PRIORITY)
**Original Files:**
- `js/WordDatabase.js` - SQL database with 760k+ words
- `js/ProgressiveDatabaseLoader.js` - Progressive loading with caching
- `js/DirectDataStorage.js` - Optimized IndexedDB storage
- `js/WordLemmatizer.js` - Word lemmatization

**Features:**
- ECDICT database (760,000+ words) with SQL.js
- Progressive loading with progress bar UI
- Multi-level caching (IndexedDB + memory)
- Chunk-based loading (by word frequency)
- Gzip compression/decompression
- Offline support
- Fast lookups (<50ms for 300 words)

**Implementation Steps:**
1. Create `src/services/database/` directory
2. Port ProgressiveDatabaseLoader.ts
3. Port DirectDataStorage.ts  
4. Port WordDatabase.ts
5. Create ProgressBar organism component
6. Integrate with Zustand store
7. Add initialization on app startup

### 2. Google Drive Sync (HIGH PRIORITY)
**Original File:**
- `js/GoogleDriveManager.js`

**Features:**
- OAuth 2.0 authentication
- Vocabulary cloud sync
- Auto-merge local/remote data
- Token refresh
- User profile display

**Implementation Steps:**
1. Complete GoogleDriveService.ts (already started)
2. Add Google Drive state to Zustand store
3. Create Settings organism with Google Drive panel
4. Add sync status indicator to Header
5. Test OAuth flow

### 3. Pronunciation Checker (MEDIUM PRIORITY)
**Original File:**
- `js/PronunciationChecker.js`

**Features:**
- Speech recognition
- Audio playback
- Pronunciation feedback
- Accuracy scoring

**Implementation Steps:**
1. Port PronunciationChecker service
2. Create PronunciationModal organism
3. Integrate with Web Speech API
4. Add UI controls

### 4. Additional Services (MEDIUM PRIORITY)
**Original Files:**
- `js/StorageHelper.js` - Storage utilities
- `js/PerformanceUtils.js` - Performance optimization
- `js/WordLemmatizer.js` - Word normalization
- `js/WorkerBridge.js` - Web Worker support

**Implementation Steps:**
1. Port each service to TypeScript
2. Integrate with existing React architecture
3. Add unit tests

### 5. Settings Management (LOW PRIORITY - Already Partially Done)
**Original File:**
- `js/SettingsManager.js`

**Status:** Basic settings already in Zustand store
**Needs:** Google Drive integration, more options

---

## Implementation Order

### Phase 1: Database Infrastructure (Days 1-2)
1. Port ProgressiveDatabaseLoader
2. Port DirectDataStorage
3. Port WordDatabase
4. Create ProgressBar component
5. Test progressive loading

### Phase 2: Google Drive Sync (Day 3)
1. Complete GoogleDriveService
2. Update Zustand store
3. Create Settings UI
4. Test sync flow

### Phase 3: UI Integration (Day 4)
1. Add progress bar to app initialization
2. Update dictionary modal with real data
3. Add sync indicators
4. Test end-to-end

### Phase 4: Pronunciation & Extras (Day 5)
1. Port PronunciationChecker
2. Port remaining services
3. Final testing
4. Documentation

---

## Success Criteria

✅ All dictionary lookups use real ECDICT data
✅ Progress bar shows during database loading
✅ Data cached in IndexedDB for offline use
✅ Google Drive sync working with OAuth
✅ Pronunciation checker functional
✅ All original features restored
✅ TypeScript strict mode passing
✅ Tests passing
✅ Production build successful

---

## Risk Mitigation

**Risk:** Large database size (compressed ~40MB)
**Mitigation:** Progressive loading, chunk-based downloads

**Risk:** IndexedDB browser compatibility
**Mitigation:** Fallback to memory-only mode

**Risk:** OAuth flow complexity
**Mitigation:** Follow original implementation closely

**Risk:** Time constraints
**Mitigation:** Prioritize dictionary and Google Drive first

---

## Notes

- Keep all original algorithms and logic
- Maintain backward compatibility with stored data
- Use TypeScript for type safety
- Follow Atomic Design for new UI components
- Test on mobile viewport throughout
