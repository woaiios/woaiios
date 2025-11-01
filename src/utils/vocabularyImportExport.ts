/**
 * Vocabulary Import/Export Utilities
 * Handles import/export operations for vocabulary data
 */

import type { VocabularyItem, DifficultyLevel } from '../types';

/**
 * Export vocabulary to JSON file
 */
export function exportVocabulary(vocabulary: VocabularyItem[]): void {
  const data = JSON.stringify(vocabulary, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocabulary-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import vocabulary from JSON file
 */
export function importVocabulary(
  file: File,
  addWord: (word: string, difficulty: DifficultyLevel, phonetic?: string, translation?: string) => void,
  onError?: (message: string) => void
): void {
  const reader = new FileReader();
  
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target?.result as string);
      
      if (!Array.isArray(data)) {
        onError?.('Invalid file format: expected an array');
        return;
      }

      let imported = 0;
      data.forEach((item: any) => {
        if (item.word && item.difficulty) {
          addWord(item.word, item.difficulty, item.phonetic, item.translation);
          imported++;
        }
      });

      console.log(`Successfully imported ${imported} vocabulary items`);
    } catch (error) {
      onError?.('Invalid file format: unable to parse JSON');
      console.error('Import error:', error);
    }
  };

  reader.onerror = () => {
    onError?.('Failed to read file');
  };

  reader.readAsText(file);
}
