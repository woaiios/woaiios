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
        // 仅首次加载阶段允许显示遮罩；后台分块加载不得再次弹出遮罩
        this.initialLoadDone = false;
    }

    /**
     * 初始化进度回调 - Initialize progress callbacks
     */
    initialize() {
        // 设置进度回调 - 更新加载进度条
        this.dataStorage.setProgressCallback((data) => {
            // 进度回调会随后台分块（chunk 2..N）反复触发，
            // 一旦首批加载完成（initialLoadDone=true）就绝不再显示遮罩
            if (!this.initialLoadDone) {
                this.elements.overlay.classList.add('show');
            }

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
        const loader = this.dataStorage._wordDatabase?.progressiveLoader;
        if (loader) {
            loader.on('chunkLoaded', (data) => {
                const cacheStatus = data.fromCache ? ' (cached)' : '';
                this.elements.chunks.textContent = `${data.loaded}/${data.total} chunks${cacheStatus}`;
            });

            // 所有分块加载完成后隐藏遮罩
            loader.on('complete', () => {
                this.hideOverlay();
            });
        }
    }

    /**
     * 隐藏加载遮罩 - Hide the db-loading overlay
     */
    hideOverlay() {
        this.initialLoadDone = true;
        this.elements.overlay.classList.remove('show');
    }

    /**
     * 首批数据加载完成后隐藏遮罩 - Hide overlay after first chunks
     * 应用已可用 (App is usable)
     */
    hideAfterFirstLoad() {
        // 给首屏进度条一个轻微的收尾停顿，然后隐藏
        setTimeout(() => this.hideOverlay(), 500);
        // 兜底：即便 complete 事件未触发，也在合理超时后强制移除遮罩，
        // 避免界面元素残留（例如离线/缓存场景下 complete 不可达）
        setTimeout(() => this.hideOverlay(), 15000);
    }
}
