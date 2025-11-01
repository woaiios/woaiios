/**
 * ProgressBar - Molecule Component
 * Displays loading progress with percentage and message
 */

import { clsx } from 'clsx';

interface ProgressBarProps {
  percentage: number;
  message?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({
  percentage,
  message,
  showPercentage = true,
  className,
}: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className={clsx('w-full', className)}>
      {message && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {message}
        </div>
      )}
      <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 dark:bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${clampedPercentage}%` }}
        />
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
            {Math.round(clampedPercentage)}%
          </div>
        )}
      </div>
    </div>
  );
}
