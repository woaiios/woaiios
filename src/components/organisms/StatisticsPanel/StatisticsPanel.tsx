interface StatisticsPanelProps {
  totalWords: number;
  uniqueWords: number;
  highlightedWords: number;
  vocabularyCount: number;
}

export const StatisticsPanel = ({
  totalWords,
  uniqueWords,
  highlightedWords,
  vocabularyCount,
}: StatisticsPanelProps) => {
  const stats = [
    { label: 'Total Words', value: totalWords, color: 'bg-purple-100 text-purple-700' },
    { label: 'Unique Words', value: uniqueWords, color: 'bg-blue-100 text-blue-700' },
    { label: 'Highlighted', value: highlightedWords, color: 'bg-green-100 text-green-700' },
    { label: 'In Vocabulary', value: vocabularyCount, color: 'bg-orange-100 text-orange-700' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📊</span>
        <h2 className="text-xl font-bold">Statistics</h2>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.color} rounded-lg p-4 text-center`}
          >
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
