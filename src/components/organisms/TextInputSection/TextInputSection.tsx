import { Textarea, Button, Select } from '../../atoms';
import type { DifficultyLevel } from '../../../types';

interface TextInputSectionProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  wordCount: number;
  uniqueWordCount: number;
  difficultyLevel: DifficultyLevel;
  onDifficultyChange: (level: DifficultyLevel) => void;
  highlightMode: string;
  onHighlightModeChange: (mode: string) => void;
  showTranslation: boolean;
  onShowTranslationChange: (show: boolean) => void;
}

export const TextInputSection = ({
  value,
  onChange,
  onClear,
  wordCount,
  uniqueWordCount,
  difficultyLevel,
  onDifficultyChange,
  highlightMode,
  onHighlightModeChange,
  showTranslation,
  onShowTranslationChange,
}: TextInputSectionProps) => {
  const difficultyOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
  ];

  const highlightModeOptions = [
    { value: 'all', label: 'All Words' },
    { value: 'unknown', label: 'Unknown Only' },
    { value: 'none', label: 'No Highlight' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📝</span>
        <h2 className="text-xl font-bold">Enter Your Text</h2>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste or type your English text here..."
        rows={6}
        className="mb-4"
      />

      <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div className="text-sm text-gray-600">
          {wordCount} words · {uniqueWordCount} unique
        </div>
        <Button variant="outline" onClick={onClear}>
          Clear
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Difficulty Level"
          options={difficultyOptions}
          value={difficultyLevel}
          onChange={(e) => onDifficultyChange(e.target.value as DifficultyLevel)}
        />
        
        <Select
          label="Highlight Mode"
          options={highlightModeOptions}
          value={highlightMode}
          onChange={(e) => onHighlightModeChange(e.target.value)}
        />

        <div className="flex items-center gap-2 mt-6">
          <input
            type="checkbox"
            id="showTranslation"
            checked={showTranslation}
            onChange={(e) => onShowTranslationChange(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="showTranslation" className="text-sm font-medium">
            Show Translations
          </label>
        </div>
      </div>
    </div>
  );
};
