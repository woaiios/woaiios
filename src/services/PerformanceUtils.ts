/**
 * Performance Utilities
 * Helper functions for optimizing performance through idle callbacks and chunked processing
 */

/**
 * Schedule a task to run during browser idle time
 * Falls back to setTimeout if requestIdleCallback is not available
 */
export function scheduleIdleTask(callback: () => void, timeout = 1000): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 0);
  }
}

/**
 * Process large arrays in chunks to avoid blocking the UI
 * Yields to browser between chunks for responsiveness
 */
export async function processInChunks<T>(
  array: T[],
  chunkSize: number,
  processFn: (chunk: T[]) => void | Promise<void>,
  delay = 0
): Promise<void> {
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    await processFn(chunk);
    
    if (i + chunkSize < array.length && delay > 0) {
      // Yield to browser
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Measure execution time of a function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
  return result;
}

/**
 * Debounce function to limit execution rate
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit execution rate (executes at most once per interval)
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
