import { BookOpen, Settings, Mic } from 'lucide-react';
import { Button } from '../../atoms';
import { Badge } from '../../atoms';

interface HeaderProps {
  vocabularyCount: number;
  onVocabularyClick: () => void;
  onSettingsClick: () => void;
  onPronunciationClick: () => void;
}

export const Header = ({
  vocabularyCount,
  onVocabularyClick,
  onSettingsClick,
  onPronunciationClick,
}: HeaderProps) => {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={32} />
            <h1 className="text-2xl font-bold">Word Discoverer</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onVocabularyClick}
              icon={<BookOpen size={20} />}
              className="text-white hover:bg-white/20"
            >
              Vocabulary
              {vocabularyCount > 0 && (
                <Badge variant="warning" className="ml-2">
                  {vocabularyCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="ghost"
              onClick={onPronunciationClick}
              icon={<Mic size={20} />}
              className="text-white hover:bg-white/20"
            >
              Pronunciation
            </Button>
            
            <Button
              variant="ghost"
              onClick={onSettingsClick}
              icon={<Settings size={20} />}
              className="text-white hover:bg-white/20"
            >
              Settings
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
