/**
 * WorkerBridge
 * Provides a Promise-based interface for communicating with Web Workers
 * Handles message passing and response handling
 */

export class WorkerBridge {
    constructor(workerPath) {
        this.workerPath = workerPath;
        this.worker = null;
        this.messageId = 0;
        this.pendingMessages = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize the worker
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            this.worker = new Worker(this.workerPath, { type: 'module' });
            
            this.worker.onmessage = (event) => {
                const { id, type, result, error } = event.data;
                
                const pending = this.pendingMessages.get(id);
                if (!pending) {
                    console.warn(`Received response for unknown message ID: ${id}`);
                    return;
                }
                
                this.pendingMessages.delete(id);
                
                if (type === 'success') {
                    pending.resolve(result);
                } else if (type === 'error') {
                    const err = new Error(error.message);
                    err.stack = error.stack;
                    pending.reject(err);
                } else {
                    pending.reject(new Error(`Unknown response type: ${type}`));
                }
            };
            
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                // Reject all pending messages
                for (const [id, pending] of this.pendingMessages.entries()) {
                    pending.reject(new Error(`Worker error: ${error.message}`));
                }
                this.pendingMessages.clear();
            };
            
            this.isInitialized = true;
            console.log(`✅ Worker initialized: ${this.workerPath}`);
            
        } catch (error) {
            console.error(`Failed to initialize worker: ${this.workerPath}`, error);
            throw error;
        }
    }

    /**
     * Send a message to the worker and wait for response
     * @param {string} type - Message type
     * @param {Object} payload - Message payload
     * @returns {Promise<any>} - Result from worker
     */
    async sendMessage(type, payload = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            
            // Store promise handlers
            this.pendingMessages.set(id, { resolve, reject });
            
            // Send message to worker
            this.worker.postMessage({
                id,
                type,
                payload
            });
            
            // Set timeout to prevent hanging
            setTimeout(() => {
                if (this.pendingMessages.has(id)) {
                    this.pendingMessages.delete(id);
                    reject(new Error(`Worker request timeout: ${type}`));
                }
            }, 30000); // 30 second timeout
        });
    }

    /**
     * Terminate the worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
            this.pendingMessages.clear();
            console.log(`❌ Worker terminated: ${this.workerPath}`);
        }
    }
}
