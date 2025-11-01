import { ReactNode } from 'react';

interface MainTemplateProps {
  header: ReactNode;
  textInput: ReactNode;
  statistics: ReactNode;
  analyzedText: ReactNode;
  highlightedWords: ReactNode;
  modals: ReactNode;
}

export const MainTemplate = ({
  header,
  textInput,
  statistics,
  analyzedText,
  highlightedWords,
  modals,
}: MainTemplateProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {header}
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {textInput}
          {statistics}
          {analyzedText}
          {highlightedWords}
        </div>
      </main>

      {modals}
    </div>
  );
};
