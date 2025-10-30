/**
 * Storage Worker
 * Handles localStorage operations off the main thread
 * Processes JSON serialization/deserialization in background
 */

// Message handler
self.onmessage = async function(event) {
    const { id, type, payload } = event.data;
    
    try {
        let result;
        
        switch (type) {
            case 'getItem':
                result = await handleGetItem(payload.key);
                break;
                
            case 'setItem':
                result = await handleSetItem(payload.key, payload.value);
                break;
                
            case 'removeItem':
                result = await handleRemoveItem(payload.key);
                break;
                
            case 'clear':
                result = await handleClear();
                break;
                
            case 'parseJSON':
                result = await handleParseJSON(payload.data);
                break;
                
            case 'stringifyJSON':
                result = await handleStringifyJSON(payload.data);
                break;
                
            default:
                throw new Error(\`Unknown operation type: \${type}\`);
        }
        
        // Send success response
        self.postMessage({
            id,
            type: 'success',
            result
        });
        
    } catch (error) {
        // Send error response
        self.postMessage({
            id,
            type: 'error',
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
};

/**
 * Get item from localStorage and parse JSON
 */
async function handleGetItem(key) {
    // Simulate async operation to allow yielding to event loop
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const value = localStorage.getItem(key);
    if (value === null) {
        return null;
    }
    
    // Parse JSON off main thread
    try {
        return JSON.parse(value);
    } catch (error) {
        console.error(\`Error parsing JSON for key "\${key}":\`, error);
        return null;
    }
}

/**
 * Stringify JSON and set item in localStorage
 */
async function handleSetItem(key, value) {
    // Simulate async operation to allow yielding to event loop
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Stringify JSON off main thread
    const jsonString = JSON.stringify(value);
    
    localStorage.setItem(key, jsonString);
    return true;
}

/**
 * Remove item from localStorage
 */
async function handleRemoveItem(key) {
    await new Promise(resolve => setTimeout(resolve, 0));
    localStorage.removeItem(key);
    return true;
}

/**
 * Clear all localStorage
 */
async function handleClear() {
    await new Promise(resolve => setTimeout(resolve, 0));
    localStorage.clear();
    return true;
}

/**
 * Parse JSON data
 */
async function handleParseJSON(data) {
    await new Promise(resolve => setTimeout(resolve, 0));
    return JSON.parse(data);
}

/**
 * Stringify JSON data
 */
async function handleStringifyJSON(data) {
    await new Promise(resolve => setTimeout(resolve, 0));
    return JSON.stringify(data);
}
