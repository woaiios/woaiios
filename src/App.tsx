import { useState, useEffect } from 'react';
import { Button } from './components/atoms';
import { SearchBar } from './components/molecules';
import { Modal } from './components/organisms';
import {
  Header,
  TextInputSection,
  StatisticsPanel,
  AnalyzedTextSection,
  HighlightedWordsList,
} from './components/organisms';
import { MainTemplate } from './components/templates';
import { useAppStore } from './store';
import { TextAnalyzerService } from './services/TextAnalyzerService';
import { Trash2, Download, Upload } from 'lucide-react';
import type { DifficultyLevel, AnalyzedWord } from './types';

const textAnalyzer = new TextAnalyzerService();

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
    setAnalysisResult,
    selectedWord,
    setSelectedWord,
    setIsAnalyzing,
  } = useAppStore();

  const [showVocabulary, setShowVocabulary] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showPronunciation, setShowPronunciation] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vocabTab, setVocabTab] = useState<'learning' | 'mastered'>('learning');

  // Analyze text function
  const analyzeText = async (): Promise<void> => {
    if (!currentText.trim()) {
      setAnalysisResult(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const vocabSet = new Set<string>(vocabulary.map(v => v.word.toLowerCase()));
      const result = await textAnalyzer.analyzeText(currentText, vocabSet);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Error analyzing text:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-analyze when settings change
  useEffect(() => {
    if (currentText.trim()) {
      analyzeText();
    }
  }, [settings.difficultyLevel, settings.highlightMode]);

  // Debounced analysis on text change
  useEffect(() => {
    if (!currentText.trim()) {
      setAnalysisResult(null);
      return;
    }

    const timer = setTimeout(() => {
      analyzeText();
    }, 500);

    return () => clearTimeout(timer);
  }, [currentText, vocabulary]);

  const handleWordClick = (word: AnalyzedWord) => {
    setSelectedWord({
      word: word.word,
      definition: `Definition for "${word.word}"`,
      phonetic: `/${word.word}/`,
      translation: `${word.word} 的中文翻译`,
    });
  };

  const handleAddToVocabulary = (word: string, difficulty: DifficultyLevel) => {
    const phonetic = selectedWord?.phonetic;
    const translation = selectedWord?.translation;
    addWord(word, difficulty, phonetic, translation);
    setSelectedWord(null);
  };

  const exportVocabulary = (): void => {
    const data = JSON.stringify(vocabulary, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabulary-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importVocabulary = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            if (item.word && item.difficulty) {
              addWord(item.word, item.difficulty, item.phonetic, item.translation);
            }
          });
        }
      } catch (error) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
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
          words={highlightedWords}
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
                <Button variant="outline" onClick={exportVocabulary} icon={<Download size={16} />}>
                  Export
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={importVocabulary}
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
            size="md"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Auto-save</label>
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                  className="w-4 h-4"
                />
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
