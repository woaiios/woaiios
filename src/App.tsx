import { useState, useEffect } from 'react';
import { BookOpen, Settings, Trash2, Download, Upload, Mic } from 'lucide-react';
import { Button, Textarea, Badge, Select } from './components/atoms';
import { SearchBar, ControlGroup } from './components/molecules';
import { Modal } from './components/organisms/Modal';
import { useAppStore } from './store';
import { TextAnalyzerService } from './services/TextAnalyzerService';
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
    getWordStatus,
    currentText,
    setCurrentText,
    analysisResult,
    setAnalysisResult,
    selectedWord,
    setSelectedWord,
    isAnalyzing,
    setIsAnalyzing,
  } = useAppStore();

  const [showVocabulary, setShowVocabulary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [vocabTab, setVocabTab] = useState<'learning' | 'mastered'>('learning');

  // Re-analyze when settings change
  useEffect(() => {
    if (currentText.trim()) {
      analyzeText();
    }
  }, [settings.difficultyLevel, settings.highlightMode]);

  // Analyze text function
  const analyzeText = async () => {
    if (!currentText.trim()) {
      setAnalysisResult(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const vocabSet = new Set(vocabulary.map(v => v.word.toLowerCase()));
      const result = await textAnalyzer.analyzeText(currentText, vocabSet);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Error analyzing text:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
    // Get phonetic and translation from selectedWord
    const phonetic = selectedWord?.phonetic;
    const translation = selectedWord?.translation;
    addWord(word, difficulty, phonetic, translation);
    setSelectedWord(null);
  };

  // Filter vocabulary by search and tab
  const filteredVocabulary = vocabulary
    .filter(item => item.status === vocabTab)
    .filter(item => item.word.toLowerCase().includes(searchQuery.toLowerCase()));

  const difficultyOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
  ];

  const highlightOptions = [
    { value: 'all', label: 'All Words' },
    { value: 'unknown', label: 'Unknown Only' },
    { value: 'none', label: 'No Highlight' },
  ];

  const exportVocabulary = () => {
    const data = JSON.stringify(vocabulary, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabulary-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importVocabulary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.word && item.difficulty) {
              addWord(item.word, item.difficulty);
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
  const getHighlightedWords = () => {
    if (!analysisResult) return [];
    
    const difficultyThreshold = {
      beginner: 25,
      intermediate: 50,
      advanced: 75,
      expert: 100,
    }[settings.difficultyLevel];

    return analysisResult.words.filter(word => {
      if (settings.highlightMode === 'none') return false;
      if (settings.highlightMode === 'unknown') return !word.isLearning && word.score >= difficultyThreshold;
      return word.score >= difficultyThreshold;
    });
  };

  const highlightedWords = getHighlightedWords();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={28} />
              <h1 className="text-2xl font-bold">Word Discoverer</h1>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setShowPronunciation(true)}
              >
                <Mic size={18} />
                <span className="hidden sm:inline">Pronunciation</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setShowVocabulary(true)}
              >
                <BookOpen size={18} />
                <span className="hidden sm:inline">Vocabulary</span>
                <Badge variant="info" size="sm">{vocabulary.length}</Badge>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setShowSettings(true)}
              >
                <Settings size={18} />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📝 Enter Your Text</h2>
          <Textarea
            placeholder="Paste your English text here to analyze word difficulty..."
            rows={6}
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            className="w-full mb-4"
          />
          
          {/* Analysis Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty Level:
              </label>
              <Select
                options={difficultyOptions}
                value={settings.difficultyLevel}
                onChange={(e) =>
                  updateSettings({ difficultyLevel: e.target.value as DifficultyLevel })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Highlight Mode:
              </label>
              <Select
                options={highlightOptions}
                value={settings.highlightMode}
                onChange={(e) =>
                  updateSettings({ highlightMode: e.target.value as any })
                }
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showTranslation}
                  onChange={(e) => updateSettings({ showTranslation: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="text-sm text-gray-700">Show Translations</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {analysisResult && (
                <span>
                  {analysisResult.totalWords} words · {analysisResult.uniqueWords} unique
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentText('')}
                disabled={!currentText}
              >
                <Trash2 size={16} />
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={analyzeText}
                disabled={!currentText.trim() || isAnalyzing}
                loading={isAnalyzing}
              >
                Analyze
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {analysisResult && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="text-2xl font-bold text-purple-600">{analysisResult.totalWords}</div>
              <div className="text-sm text-gray-600">Total Words</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="text-2xl font-bold text-blue-600">{analysisResult.uniqueWords}</div>
              <div className="text-sm text-gray-600">Unique Words</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="text-2xl font-bold text-green-600">{highlightedWords.length}</div>
              <div className="text-sm text-gray-600">Highlighted</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="text-2xl font-bold text-orange-600">{vocabulary.length}</div>
              <div className="text-sm text-gray-600">In Vocabulary</div>
            </div>
          </div>
        )}

        {/* Analysis Result */}
        {analysisResult && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              🎯 Analyzed Text
              {isAnalyzing && <span className="text-sm text-gray-500 ml-2">(Analyzing...)</span>}
            </h2>
            
            {/* Word Cloud - Only show highlighted/difficult words */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {highlightedWords.map((word, index) => {
                  const color = textAnalyzer.getDifficultyColor(word.difficulty);
                  const isInVocab = isWordInVocabulary(word.word);
                  const vocabItem = vocabulary.find(v => v.word.toLowerCase() === word.word.toLowerCase());
                  
                  return (
                    <div key={`${word.word}-${index}`} className="relative group">
                      <button
                        onClick={() => handleWordClick(word)}
                        className="px-3 py-2 rounded-lg font-medium transition-all hover:scale-110 hover:shadow-lg relative"
                        style={{
                          backgroundColor: `${color}20`,
                          color: color,
                          border: `2px solid ${color}`,
                        }}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-bold">{word.original}</span>
                          {vocabItem?.phonetic && (
                            <span className="text-xs opacity-75">{vocabItem.phonetic}</span>
                          )}
                        </div>
                        {isInVocab && <span className="ml-1">⭐</span>}
                      </button>
                      
                      {/* Hover tooltip showing phonetic and translation */}
                      {settings.showTranslation && vocabItem && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          <div className="text-center">
                            {vocabItem.phonetic && <div className="font-mono">{vocabItem.phonetic}</div>}
                            {vocabItem.translation && <div className="mt-1">{vocabItem.translation}</div>}
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#7ED321' }}></div>
                  <span className="text-sm text-gray-600">Beginner</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F5A623' }}></div>
                  <span className="text-sm text-gray-600">Intermediate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#D0021B' }}></div>
                  <span className="text-sm text-gray-600">Advanced</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#9013FE' }}></div>
                  <span className="text-sm text-gray-600">Expert</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">⭐</span>
                  <span className="text-sm text-gray-600">In Vocabulary</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Highlighted Words List */}
        {highlightedWords.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              📋 Highlighted Words ({highlightedWords.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {highlightedWords.map((word, index) => {
                const color = textAnalyzer.getDifficultyColor(word.difficulty);
                const isInVocab = isWordInVocabulary(word.word);
                
                return (
                  <button
                    key={`hl-${word.word}-${index}`}
                    onClick={() => handleWordClick(word)}
                    className="px-3 py-2 rounded-lg font-medium transition-all hover:scale-105 hover:shadow-md text-left"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                      border: `2px solid ${color}`,
                    }}
                  >
                    {word.word}
                    {isInVocab && ' ⭐'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Word Dictionary Modal */}
      <Modal
        isOpen={!!selectedWord}
        onClose={() => setSelectedWord(null)}
        title="Word Details"
        size="md"
      >
        {selectedWord && (
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedWord.word}
              </h3>
              {selectedWord.phonetic && (
                <p className="text-gray-600">{selectedWord.phonetic}</p>
              )}
            </div>

            {selectedWord.definition && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Definition:</h4>
                <p className="text-gray-600">{selectedWord.definition}</p>
              </div>
            )}

            {selectedWord.translation && settings.showTranslation && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Translation:</h4>
                <p className="text-gray-600">{selectedWord.translation}</p>
              </div>
            )}

            <div className="pt-4">
              {isWordInVocabulary(selectedWord.word) ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => removeWord(selectedWord.word)}
                >
                  <Trash2 size={16} />
                  Remove from Vocabulary
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-2">Add to vocabulary as:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToVocabulary(selectedWord.word, 'beginner')}
                    >
                      Beginner
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToVocabulary(selectedWord.word, 'intermediate')}
                    >
                      Intermediate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToVocabulary(selectedWord.word, 'advanced')}
                    >
                      Advanced
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToVocabulary(selectedWord.word, 'expert')}
                    >
                      Expert
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Vocabulary Modal */}
      <Modal
        isOpen={showVocabulary}
        onClose={() => setShowVocabulary(false)}
        title="My Vocabulary"
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportVocabulary}>
              <Download size={16} />
              Export
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300 px-3 py-1.5 text-sm">
                <Upload size={16} />
                Import
              </span>
              <input
                type="file"
                accept=".json"
                onChange={importVocabulary}
                className="hidden"
              />
            </label>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm('Clear all vocabulary?')) {
                  clearVocabulary();
                }
              }}
            >
              <Trash2 size={16} />
              Clear All
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Tabs for Learning/Mastered */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                vocabTab === 'learning'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setVocabTab('learning')}
            >
              Learning ({vocabulary.filter(v => v.status === 'learning').length})
            </button>
            <button
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                vocabTab === 'mastered'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setVocabTab('mastered')}
            >
              Mastered ({vocabulary.filter(v => v.status === 'mastered').length})
            </button>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search vocabulary..."
          />

          {filteredVocabulary.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {vocabulary.filter(v => v.status === vocabTab).length === 0 ? (
                <p>No words in {vocabTab} list yet.</p>
              ) : (
                <p>No words found matching "{searchQuery}"</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVocabulary.map((item) => (
                <div
                  key={item.word}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{item.word}</span>
                      <Badge variant="primary" size="sm">
                        {item.difficulty}
                      </Badge>
                    </div>
                    {item.phonetic && (
                      <div className="text-sm text-gray-600 font-mono">{item.phonetic}</div>
                    )}
                    {item.translation && (
                      <div className="text-sm text-gray-600 mt-0.5">{item.translation}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWordStatus(item.word)}
                      title={item.status === 'learning' ? 'Mark as mastered' : 'Move to learning'}
                    >
                      {item.status === 'learning' ? '✓' : '↺'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWord(item.word)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
        size="md"
      >
        <div className="space-y-6">
          <ControlGroup
            type="select"
            label="Difficulty Level"
            selectProps={{
              options: difficultyOptions,
              value: settings.difficultyLevel,
              onChange: (e) =>
                updateSettings({ difficultyLevel: e.target.value as DifficultyLevel }),
            }}
            helperText="Words easier than this level will be hidden"
          />

          <ControlGroup
            type="select"
            label="Highlight Mode"
            selectProps={{
              options: highlightOptions,
              value: settings.highlightMode,
              onChange: (e) =>
                updateSettings({ highlightMode: e.target.value as any }),
            }}
          />

          <ControlGroup
            type="checkbox"
            checkboxLabel="Show translations on hover"
            checked={settings.showTranslation}
            onChange={(checked) => updateSettings({ showTranslation: checked })}
          />

          <ControlGroup
            type="checkbox"
            checkboxLabel="Auto-save vocabulary"
            checked={settings.autoSave}
            onChange={(checked) => updateSettings({ autoSave: checked })}
          />
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
          <Mic size={64} className="mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600 mb-4">
            Pronunciation checker feature coming soon!
          </p>
          <p className="text-sm text-gray-500">
            This feature will allow you to practice pronunciation and get feedback.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default App;
