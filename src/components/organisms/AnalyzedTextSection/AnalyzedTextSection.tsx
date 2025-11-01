import type { AnalyzedWord, VocabularyItem } from '../../../types';

interface AnalyzedTextSectionProps {
  words: AnalyzedWord[];
  highlightedWords: AnalyzedWord[];
  vocabulary: VocabularyItem[];
  showTranslation: boolean;
  onWordClick: (word: AnalyzedWord) => void;
}

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-100 border-green-400 text-green-800',
  intermediate: 'bg-orange-100 border-orange-400 text-orange-800',
  advanced: 'bg-red-100 border-red-400 text-red-800',
  expert: 'bg-purple-100 border-purple-400 text-purple-800',
};

export const AnalyzedTextSection = ({
  words,
  highlightedWords,
  vocabulary,
  showTranslation,
  onWordClick,
}: AnalyzedTextSectionProps) => {
  const getVocabItem = (word: string) => {
    return vocabulary.find(
      (v) => v.word.toLowerCase() === word.toLowerCase()
    );
  };

  const isHighlighted = (word: AnalyzedWord) => {
    return highlightedWords.some(
      (hw) => hw.word.toLowerCase() === word.word.toLowerCase()
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎯</span>
        <h2 className="text-xl font-bold">Analyzed Text</h2>
      </div>

      {words.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {words.map((word, index) => {
              const vocabItem = getVocabItem(word.word);
              const isInVocab = !!vocabItem;
              const highlighted = isHighlighted(word);
              const colorClass = highlighted ? difficultyColors[word.difficulty] : 'bg-gray-50 border-gray-300 text-gray-700';

              return (
                <div key={`${word.word}-${index}`} className="relative group">
                  <button
                    onClick={() => onWordClick(word)}
                    className={`${colorClass} border-2 rounded-lg px-3 py-2 font-medium transition-all hover:shadow-md cursor-pointer flex items-center gap-1`}
                  >
                    <div className="flex flex-col items-start">
                      <span>{word.original}</span>
                      {isInVocab && vocabItem.phonetic && (
                        <span className="text-xs opacity-75">{vocabItem.phonetic}</span>
                      )}
                    </div>
                    {isInVocab && <span className="text-yellow-500">⭐</span>}
                  </button>

                  {showTranslation && vocabItem && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {vocabItem.phonetic && <div>{vocabItem.phonetic}</div>}
                      {vocabItem.translation && <div>{vocabItem.translation}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div>
              <span>Beginner</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border-2 border-orange-400 rounded"></div>
              <span>Intermediate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded"></div>
              <span>Advanced</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border-2 border-purple-400 rounded"></div>
              <span>Expert</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">⭐</span>
              <span>In Vocabulary</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-8">
          Enter text above to see analysis
        </p>
      )}
    </div>
  );
};
