import { Button } from './components/atoms';
import { SearchBar } from './components/molecules';
import { Modal } from './components/organisms';
import {
  Header,
  TextInputSection,
  StatisticsPanel,
  AnalyzedTextSection,
  HighlightedWordsList,
  GoogleDrivePanel,
} from './components/organisms';
import { MainTemplate } from './components/templates';
import { useAppStore } from './store';
import { useModalStates, useTextAnalysis, useVocabularyActions } from './hooks';
import { exportVocabulary, importVocabulary } from './utils/vocabularyImportExport';
import { Trash2, Download, Upload } from 'lucide-react';
import type { DifficultyLevel, AnalyzedWord } from './types';

function App() {
  const {
    settings,
    updateSettings,
    vocabulary,
    addWord,
    removeWord,
    toggleWordStatus,
    clearVocabulary,
    isWordInVocabulary,
    currentText,
    setCurrentText,
    analysisResult,
    selectedWord,
    setSelectedWord,
  } = useAppStore();

  // Custom hooks for separated concerns
  const {
    showVocabulary,
    setShowVocabulary,
    showSettings,
    setShowSettings,
    showPronunciation,
    setShowPronunciation,
    searchQuery,
    setSearchQuery,
    vocabTab,
    setVocabTab,
  } = useModalStates();

  useTextAnalysis();

  const { handleWordClick, handleAddToVocabulary } = useVocabularyActions();

  // File import handler
  const handleImportVocabulary = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    importVocabulary(file, addWord, (error) => alert(error));
  };

  // Get highlighted/difficult words based on settings
  const getHighlightedWords = (): AnalyzedWord[] => {
    if (!analysisResult) return [];
    
    const difficultyThreshold: Record<DifficultyLevel, number> = {
      beginner: 25,
      intermediate: 50,
      advanced: 75,
      expert: 100,
    };
    
    const threshold = difficultyThreshold[settings.difficultyLevel];

    return analysisResult.words.filter((word: AnalyzedWord) => {
      if (settings.highlightMode === 'none') return false;
      if (settings.highlightMode === 'unknown') 
        return !word.isLearning && word.score >= threshold;
      return word.score >= threshold;
    });
  };

  const highlightedWords = getHighlightedWords();
  const filteredVocabulary = vocabulary
    .filter(item => item.status === vocabTab)
    .filter(item => item.word.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <MainTemplate
      header={
        <Header
          vocabularyCount={vocabulary.length}
          onVocabularyClick={() => setShowVocabulary(true)}
          onSettingsClick={() => setShowSettings(true)}
          onPronunciationClick={() => setShowPronunciation(true)}
        />
      }
      textInput={
        <TextInputSection
          value={currentText}
          onChange={setCurrentText}
          onClear={() => setCurrentText('')}
          wordCount={analysisResult?.totalWords || 0}
          uniqueWordCount={analysisResult?.uniqueWords || 0}
          difficultyLevel={settings.difficultyLevel}
          onDifficultyChange={(level) => updateSettings({ difficultyLevel: level })}
          highlightMode={settings.highlightMode}
          onHighlightModeChange={(mode) => updateSettings({ highlightMode: mode as any })}
          showTranslation={settings.showTranslation}
          onShowTranslationChange={(show) => updateSettings({ showTranslation: show })}
        />
      }
      statistics={
        analysisResult && (
          <StatisticsPanel
            totalWords={analysisResult.totalWords}
            uniqueWords={analysisResult.uniqueWords}
            highlightedWords={highlightedWords.length}
            vocabularyCount={vocabulary.length}
          />
        )
      }
      analyzedText={
        <AnalyzedTextSection
          words={analysisResult?.words || []}
          highlightedWords={highlightedWords}
          vocabulary={vocabulary}
          showTranslation={settings.showTranslation}
          onWordClick={handleWordClick}
        />
      }
      highlightedWords={
        <HighlightedWordsList
          words={highlightedWords}
          vocabulary={vocabulary}
          onWordClick={handleWordClick}
        />
      }
      modals={
        <>
          {/* Word Details Modal */}
          <Modal
            isOpen={!!selectedWord}
            onClose={() => setSelectedWord(null)}
            title="Word Details"
            size="md"
          >
            {selectedWord && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {selectedWord.word}
                  </h3>
                  <p className="text-gray-600">{selectedWord.phonetic}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Definition:</h4>
                  <p className="text-gray-600">{selectedWord.definition}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Translation:</h4>
                  <p className="text-gray-600">{selectedWord.translation}</p>
                </div>

                {isWordInVocabulary(selectedWord.word) ? (
                  <Button
                    variant="danger"
                    onClick={() => {
                      removeWord(selectedWord.word);
                      setSelectedWord(null);
                    }}
                    className="w-full"
                  >
                    Remove from Vocabulary
                  </Button>
                ) : (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">
                      Add to vocabulary as:
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {(['beginner', 'intermediate', 'advanced', 'expert'] as DifficultyLevel[]).map(
                        (level) => (
                          <Button
                            key={level}
                            variant="outline"
                            onClick={() => handleAddToVocabulary(selectedWord.word, level)}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Vocabulary Modal */}
          <Modal
            isOpen={showVocabulary}
            onClose={() => setShowVocabulary(false)}
            title="Vocabulary"
            size="lg"
          >
            <div className="space-y-4">
              <div className="flex gap-2 border-b">
                <button
                  onClick={() => setVocabTab('learning')}
                  className={`px-4 py-2 font-medium ${
                    vocabTab === 'learning'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500'
                  }`}
                >
                  Learning ({vocabulary.filter(v => v.status === 'learning').length})
                </button>
                <button
                  onClick={() => setVocabTab('mastered')}
                  className={`px-4 py-2 font-medium ${
                    vocabTab === 'mastered'
                      ? 'border-b-2 border-green-500 text-green-600'
                      : 'text-gray-500'
                  }`}
                >
                  Mastered ({vocabulary.filter(v => v.status === 'mastered').length})
                </button>
              </div>

              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={() => {}}
                placeholder="Search vocabulary..."
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredVocabulary.map((item) => (
                  <div
                    key={item.word}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.word}</div>
                      {item.phonetic && (
                        <div className="text-sm text-gray-600">{item.phonetic}</div>
                      )}
                      {item.translation && (
                        <div className="text-sm text-gray-500">{item.translation}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleWordStatus(item.word)}
                      >
                        {item.status === 'learning' ? '✓' : '↺'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => removeWord(item.word)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => exportVocabulary(vocabulary)} icon={<Download size={16} />}>
                  Export
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportVocabulary}
                    className="hidden"
                  />
                  <span className="inline-flex items-center justify-center gap-2 px-4 py-2 text-base border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-all">
                    <Upload size={16} />
                    Import
                  </span>
                </label>
                <Button variant="danger" onClick={clearVocabulary}>
                  Clear All
                </Button>
              </div>
            </div>
          </Modal>

          {/* Settings Modal */}
          <Modal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            title="Settings"
            size="lg"
          >
            <div className="space-y-6">
              {/* Google Drive Section */}
              <div>
                <GoogleDrivePanel />
              </div>

              {/* Divider */}
              <hr className="border-gray-200 dark:border-gray-700" />

              {/* General Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  General Settings
                </h3>
                <div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoSave}
                      onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                      Auto-save vocabulary changes
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </Modal>

          {/* Pronunciation Modal */}
          <Modal
            isOpen={showPronunciation}
            onClose={() => setShowPronunciation(false)}
            title="Pronunciation Checker"
            size="md"
          >
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Coming Soon</p>
              <p className="text-sm text-gray-500">
                Pronunciation checking feature will be available in the next update
              </p>
            </div>
          </Modal>
        </>
      }
    />
  );
}

export default App;
