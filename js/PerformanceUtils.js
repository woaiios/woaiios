/**
 * Performance Utilities
 * Helper functions for optimizing main thread performance
 */

/**
 * Schedule a task to run during browser idle time
 * @param {Function} callback - Task to execute during idle time
 * @param {Object} options - Options for idle callback
 * @returns {number} Handle ID for canceling
 */
export function scheduleIdleTask(callback, options = {}) {
    if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, options);
    } else {
        // Fallback to setTimeout with a delay
        return setTimeout(() => {
            callback({
                didTimeout: false,
                timeRemaining: () => 50
            });
        }, options.timeout || 1);
    }
}

/**
 * Cancel a previously scheduled idle task
 * @param {number} handle - Handle returned from scheduleIdleTask
 */
export function cancelIdleTask(handle) {
    if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(handle);
    } else {
        clearTimeout(handle);
    }
}

/**
 * Schedule a task for the next animation frame
 * @param {Function} callback - Task to execute
 * @returns {number} Handle ID for canceling
 */
export function scheduleAnimationTask(callback) {
    return requestAnimationFrame(callback);
}

/**
 * Cancel a scheduled animation task
 * @param {number} handle - Handle returned from scheduleAnimationTask
 */
export function cancelAnimationTask(handle) {
    cancelAnimationFrame(handle);
}

/**
 * Break a large task into smaller chunks to avoid blocking main thread
 * @param {Array} items - Items to process
 * @param {Function} processor - Function to process each item
 * @param {Object} options - Options for chunking
 * @returns {Promise} Promise that resolves when all items are processed
 */
export async function processInChunks(items, processor, options = {}) {
    const {
        chunkSize = 100,
        delay = 0,
        onProgress = null
    } = options;
    
    const totalItems = items.length;
    let processedCount = 0;
    
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        
        // Process chunk
        for (const item of chunk) {
            await processor(item);
            processedCount++;
        }
        
        // Report progress
        if (onProgress) {
            onProgress({
                processed: processedCount,
                total: totalItems,
                percentage: (processedCount / totalItems) * 100
            });
        }
        
        // Yield to main thread
        if (i + chunkSize < items.length) {
            await new Promise(resolve => {
                if (delay > 0) {
                    setTimeout(resolve, delay);
                } else {
                    scheduleIdleTask(resolve);
                }
            });
        }
    }
}

/**
 * Defer execution until the browser is idle
 * @param {Function} callback - Function to defer
 * @param {number} timeout - Maximum time to wait (ms)
 * @returns {Promise} Promise that resolves when callback completes
 */
export function defer(callback, timeout = 2000) {
    return new Promise((resolve, reject) => {
        scheduleIdleTask((deadline) => {
            try {
                const result = callback(deadline);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }, { timeout });
    });
}

/**
 * Batch DOM updates to reduce reflows and repaints
 * @param {Function} updater - Function that performs DOM updates
 * @returns {Promise} Promise that resolves after update
 */
export function batchDOMUpdate(updater) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            updater();
            resolve();
        });
    });
}

/**
 * Measure performance of a function
 * @param {string} name - Name of the measurement
 * @param {Function} fn - Function to measure
 * @returns {Promise<any>} Result of the function
 */
export async function measure(name, fn) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    performance.mark(startMark);
    
    try {
        const result = await fn();
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
        
        const measure = performance.getEntriesByName(name)[0];
        console.log(`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`);
        
        // Clean up marks and measures
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(name);
        
        return result;
    } catch (error) {
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
        
        const measure = performance.getEntriesByName(name)[0];
        console.error(`❌ ${name} failed after ${measure.duration.toFixed(2)}ms:`, error);
        
        // Clean up
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(name);
        
        throw error;
    }
}

/**
 * Debounce a function to limit how often it's called
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 300) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle a function to limit how often it's called
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
