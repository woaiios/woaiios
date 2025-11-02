/**
 * FileUtils - 文件工具类
 * 提供文件下载等工具方法
 * (Provides file download and other utility methods)
 */
export class FileUtils {
    /**
     * 下载 JSON 数据 - Download JSON data
     * 将数据转换为 JSON 文件并触发下载 (Convert data to JSON file and trigger download)
     * @param {Object} data - 要下载的数据对象 (Data object to download)
     * @param {string} filename - 文件名 (Filename)
     */
    static downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
