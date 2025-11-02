/**
 * NotificationManager - 通知管理器
 * 负责在屏幕右上角显示临时通知消息
 * (Manages temporary notification messages in the top-right corner)
 */
import { batchDOMUpdate } from '../PerformanceUtils.js';

export class NotificationManager {
    /**
     * 显示通知消息 - Show notification message
     * @param {string} message - 消息文本 (Message text)
     * @param {string} type - 消息类型：'success', 'error', 'info' (Message type)
     */
    static show(message, type = 'success') {
        batchDOMUpdate(() => {
            const notification = document.createElement('div');
            const colors = { 
                success: '#10b981', 
                error: '#ef4444', 
                info: '#3b82f6' 
            };
            
            notification.style.cssText = `
                position: fixed; 
                top: 20px; 
                right: 20px; 
                background: ${colors[type] || colors.success}; 
                color: white;
                padding: 1rem 1.5rem; 
                border-radius: 8px; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 3000; 
                animation: slideIn 0.3s ease; 
                max-width: 300px; 
                word-wrap: break-word;
            `;
            
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // 3秒后自动移除 (Auto-remove after 3 seconds)
            setTimeout(() => notification.remove(), 3000);
        });
    }
}
