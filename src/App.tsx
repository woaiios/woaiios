import { useState, useEffect } from 'react';
import { BookOpen, Settings, Trash2, Download, Upload } from 'lucide-react';
import { Button, Textarea, Badge } from './components/atoms';
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
    clearVocabulary,
    isWordInVocabulary,
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
  const [searchQuery, setSearchQuery] = useState('');

  // Analyze text whenever it changes
  useEffect(() => {
    if (!currentText.trim()) {
      setAnalysisResult(null);
      return;
    }

    const analyzeDebounced = setTimeout(async () => {
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
    }, 500);

    return () => clearTimeout(analyzeDebounced);
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
    addWord(word, difficulty);
    setSelectedWord(null);
  };

  const filteredVocabulary = vocabulary.filter(item =>
    item.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const difficultyOptions = [
    { value: 'beginner', label: 'Beginner (初级)' },
    { value: 'intermediate', label: 'Intermediate (中级)' },
    { value: 'advanced', label: 'Advanced (高级)' },
    { value: 'expert', label: 'Expert (专家)' },
  ];

  const highlightOptions = [
    { value: 'all', label: 'All Words (所有单词)' },
    { value: 'unknown', label: 'Unknown Only (仅未知)' },
    { value: 'none', label: 'No Highlight (不高亮)' },
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
            className="w-full"
          />
          <div className="flex items-center justify-between mt-4">
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
            </div>
          </div>
        </div>

        {/* Analysis Result */}
        {analysisResult && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              🎯 Analyzed Text
              {isAnalyzing && <span className="text-sm text-gray-500 ml-2">(Analyzing...)</span>}
            </h2>
            
            {/* Word Cloud */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {analysisResult.words.map((word, index) => {
                  const color = textAnalyzer.getDifficultyColor(word.difficulty);
                  const isInVocab = isWordInVocabulary(word.word);
                  
                  return (
                    <button
                      key={`${word.word}-${index}`}
                      onClick={() => handleWordClick(word)}
                      className="px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-110 hover:shadow-md"
                      style={{
                        backgroundColor: `${color}20`,
                        color: color,
                        border: `2px solid ${color}`,
                      }}
                    >
                      {word.original}
                      {isInVocab && ' ⭐'}
                    </button>
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

            {selectedWord.translation && (
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
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search vocabulary..."
          />

          {filteredVocabulary.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {vocabulary.length === 0 ? (
                <p>No words in vocabulary yet. Click on analyzed words to add them!</p>
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
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{item.word}</span>
                    <Badge variant="primary" size="sm">
                      {item.difficulty}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWord(item.word)}
                  >
                    <Trash2 size={16} />
                  </Button>
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
    </div>
  );
}

export default App;
