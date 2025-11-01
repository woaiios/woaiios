import type { AnalyzedWord, VocabularyItem } from '../../../types';

interface HighlightedWordsListProps {
  words: AnalyzedWord[];
  vocabulary: VocabularyItem[];
  onWordClick: (word: AnalyzedWord) => void;
}

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-100 border-green-400 text-green-800',
  intermediate: 'bg-orange-100 border-orange-400 text-orange-800',
  advanced: 'bg-red-100 border-red-400 text-red-800',
  expert: 'bg-purple-100 border-purple-400 text-purple-800',
};

export const HighlightedWordsList = ({
  words,
  vocabulary,
  onWordClick,
}: HighlightedWordsListProps) => {
  const getVocabItem = (word: string) => {
    return vocabulary.find(
      (v) => v.word.toLowerCase() === word.toLowerCase()
    );
  };

  if (words.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📋</span>
        <h2 className="text-xl font-bold">
          Highlighted Words ({words.length})
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {words.map((word, index) => {
          const vocabItem = getVocabItem(word.word);
          const isInVocab = !!vocabItem;
          const colorClass = difficultyColors[word.difficulty];

          return (
            <button
              key={`${word.word}-${index}`}
              onClick={() => onWordClick(word)}
              className={`${colorClass} border-2 rounded-lg px-3 py-2 font-medium transition-all hover:shadow-md cursor-pointer flex items-center justify-between gap-1`}
            >
              <div className="flex flex-col items-start text-left">
                <span>{word.original}</span>
                {isInVocab && vocabItem.phonetic && (
                  <span className="text-xs opacity-75">{vocabItem.phonetic}</span>
                )}
              </div>
              {isInVocab && <span className="text-yellow-500">⭐</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
