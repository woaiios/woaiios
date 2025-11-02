/**
 * DatabaseProgress - 数据库加载进度管理器
 * 负责管理数据库加载时的进度条显示
 * (Manages database loading progress bar display)
 * Uses DirectDataStorage as the data access layer
 */
export class DatabaseProgress {
    /**
     * 构造函数
     * @param {Object} dataStorage - DirectDataStorage 实例
     */
    constructor(dataStorage) {
        this.dataStorage = dataStorage;
        this.elements = {
            overlay: document.getElementById('dbLoadingOverlay'),
            progressBar: document.getElementById('dbProgressBar'),
            percentage: document.getElementById('dbProgressPercentage'),
            chunks: document.getElementById('dbProgressChunks'),
            message: document.getElementById('dbLoadingMessage')
        };
    }

    /**
     * 初始化进度回调 - Initialize progress callbacks
     */
    initialize() {
        // 设置进度回调 - 更新加载进度条
        this.dataStorage.setProgressCallback((data) => {
            // 只有在真正需要加载时才显示进度条
            this.elements.overlay.classList.add('show');
            
            this.elements.progressBar.style.width = `${data.percentage.toFixed(1)}%`;
            this.elements.percentage.textContent = `${data.percentage.toFixed(1)}%`;
            
            // 在消息中显示缓存状态
            let message = data.message || 'Loading...';
            if (data.fromCache === true) {
                message = `📦 ${message}`;
                this.elements.message.style.color = '#059669'; // 缓存数据显示绿色
            } else if (data.fromCache === false) {
                message = `⬇️ ${message}`;
                this.elements.message.style.color = '#3b82f6'; // 下载数据显示蓝色
            }
            this.elements.message.textContent = message;
        });
        
        // 设置分块加载完成回调
        if (this.dataStorage._wordDatabase?.progressiveLoader) {
            this.dataStorage._wordDatabase.progressiveLoader.on('chunkLoaded', (data) => {
                const cacheStatus = data.fromCache ? ' (cached)' : '';
                this.elements.chunks.textContent = `${data.loaded}/${data.total} chunks${cacheStatus}`;
            });
            
            // 所有分块加载完成后隐藏遮罩
            this.dataStorage._wordDatabase.progressiveLoader.on('complete', () => {
                setTimeout(() => {
                    this.elements.overlay.classList.remove('show');
                }, 1000);
            });
        }
    }

    /**
     * 首批数据加载完成后隐藏遮罩 - Hide overlay after first chunks
     * 应用已可用 (App is usable)
     */
    hideAfterFirstLoad() {
        setTimeout(() => {
            this.elements.overlay.classList.remove('show');
        }, 500);
    }
}
