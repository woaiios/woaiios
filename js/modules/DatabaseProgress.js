/**
 * DatabaseProgress - 数据库加载进度管理器
 * 负责管理数据库加载时的进度条显示
 * (Manages database loading progress bar display)
 * Uses DirectDataStorage as the data access layer
 *
 * 门禁策略：数据库可用（固定分片就绪，pinnedComplete）之前，
 * 遮罩全屏并拦截所有页面操作；阶段文案区分 下载/解压/连接数据库/建索引。
 */

const STAGE_LABELS = {
    wasm: '⚙️ 初始化数据库引擎…',
    download: (n, t) => `⬇️ 下载分片 ${n}/${t}`,
    decompress: (n, t) => `🗜️ 解压中 · 分片 ${n}/${t}`,
    open: (n, t) => `🔌 连接数据库 · 分片 ${n}/${t}`,
    index: (n, t) => `📇 建立反查索引 · 分片 ${n}/${t}`
};

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
        this.initialLoadDone = false;
    }

    /**
     * 初始化进度回调 - Initialize progress callbacks
     */
    initialize() {
        // 立即显示全屏阻断遮罩：数据库可用前禁止操作页面
        this.showBlocking();

        // 设置进度回调 - 更新加载进度条
        this.dataStorage.setProgressCallback((data) => {
            if (!this.initialLoadDone) {
                this.showBlocking();
            }

            const pct = Math.min(100, data.percentage || 0);
            this.elements.progressBar.style.width = `${pct.toFixed(1)}%`;
            this.elements.percentage.textContent = `${pct.toFixed(1)}%`;

            // 阶段文案：下载 / 解压 / 连接数据库 / 建索引
            const labelFn = STAGE_LABELS[data.stage];
            let message;
            if (typeof labelFn === 'function') {
                message = labelFn(data.chunkNumber || 0, data.total || 0);
            } else if (labelFn) {
                message = labelFn;
            } else {
                message = `⬇️ ${data.message || 'Loading...'}（分片间调度）`;
            }
            this.elements.message.textContent = message;
        });

        // 设置分块加载完成回调
        const loader = this.dataStorage._wordDatabase?.progressiveLoader;
        if (loader) {
            loader.on('chunkLoaded', (data) => {
                this.elements.chunks.textContent = `${data.loaded}/${data.total} chunks`;
            });

            // 数据库真正可用（固定分片就绪）后解除门禁
            loader.on('pinnedComplete', () => {
                this.hideOverlay();
            });

            // 兜底：全部分片完成也解除（兼容旧行为）
            loader.on('complete', () => {
                this.hideOverlay();
            });
        }

        // 紧急兜底：加载长时间无响应时强制解除遮罩，避免永久锁死界面
        setTimeout(() => {
            if (!this.initialLoadDone) {
                console.warn('数据库加载超时（90s），强制解除门禁');
                this.elements.message.textContent = '⚠️ 加载时间过长，已开放页面（部分功能可能不可用）';
                this.hideOverlay();
            }
        }, 90000);
    }

    /**
     * 显示全屏阻断遮罩 - Block all page interaction until DB is usable
     */
    showBlocking() {
        this.elements.overlay.classList.add('show');
        this.elements.overlay.classList.add('blocking');
    }

    /**
     * 隐藏加载遮罩（解除门禁）- Hide the db-loading overlay
     */
    hideOverlay() {
        if (this.initialLoadDone) return;
        this.initialLoadDone = true;
        this.elements.overlay.classList.remove('show');
        this.elements.overlay.classList.remove('blocking');
    }
}
