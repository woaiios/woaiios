/**
 * Modal Component
 * 模态框组件 - 用于显示弹窗内容
 * 
 * 功能特性 (Features):
 * - 响应式布局，支持移动端和桌面端 (Responsive layout for mobile and desktop)
 * - 点击背景或关闭按钮关闭 (Click backdrop or close button to dismiss)
 * - 智能垂直居中定位 (Smart vertical centering)
 * - 内容超出时自动滚动 (Auto scroll when content overflows)
 */
import { Component } from '../Component.js';

export class Modal extends Component {
    /**
     * 构造函数 - Constructor
     * @param {string} id - 模态框元素的ID (Modal element ID)
     * @param {string} title - 模态框标题 (Modal title)
     */
    constructor(id, title) {
        super(id);
        this.title = title;
        this.modalContent = null;

        // 渲染模态框HTML结构 (Render modal HTML structure)
        this.element.innerHTML = this.render();
        this.modalContent = this.element.querySelector('.modal-content');

        // 点击背景遮罩关闭模态框 (Click backdrop to close modal)
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });

        // 点击关闭按钮关闭模态框 (Click close button to close modal)
        const closeBtn = this.element.querySelector('.close-btn');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
    }

    /**
     * 渲染模态框HTML结构 - Render modal HTML structure
     * @returns {string} HTML字符串 (HTML string)
     */
    render() {
        return `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${this.title}</h2>
                    <button class="close-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <!-- Content will be injected here -->
                </div>
            </div>
        `;
    }

    /**
     * 打开模态框 - Open modal
     * @param {string} content - 要显示的内容HTML (Content HTML to display)
     */
    open(content) {
        const modalBody = this.element.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = content;
        }
        
        // 触发浏览器重排以确保内容已加载 (Trigger reflow to ensure content is loaded)
        this.element.offsetHeight;
        
        // 添加show类显示模态框 (Add show class to display modal)
        this.element.classList.add('show');
        
        // 在下一帧重新计算位置，确保内容已渲染 (Recalculate position in next frame after content is rendered)
        requestAnimationFrame(() => {
            this.calculatePosition();
        });
    }

    /**
     * 关闭模态框 - Close modal
     */
    close() {
        this.element.classList.remove('show');
    }
    
    /**
     * 计算模态框位置 - Calculate modal position
     * 根据内容高度智能定位，确保在移动端和桌面端都有良好的显示效果
     * (Smart positioning based on content height for good display on mobile and desktop)
     */
    calculatePosition() {
        const content = this.modalContent;
        if (!content) return;
        
        // 重置样式以便准确测量 (Reset styles for accurate measurement)
        content.style.marginTop = '';
        content.style.marginBottom = '';
        
        // 强制重排以获取准确尺寸 (Force reflow to get accurate dimensions)
        content.offsetHeight;
        
        // 获取视窗和内容尺寸 (Get viewport and content dimensions)
        const viewportHeight = window.innerHeight;
        const contentHeight = content.offsetHeight;
        
        // 计算垂直居中位置，但确保顶部有一定边距 (Calculate vertical center but ensure top margin)
        if (contentHeight < viewportHeight) {
            // 在移动设备上确保顶部边距不小于10px (Ensure at least 10px top margin on mobile)
            const topMargin = Math.max(10, (viewportHeight - contentHeight) / 2);
            content.style.marginTop = `${topMargin}px`;
            content.style.marginBottom = 'auto';
        } else {
            // 如果内容高度超过视窗高度，则顶部对齐并允许滚动 (If content exceeds viewport, align top and allow scrolling)
            content.style.marginTop = '10px';
            content.style.marginBottom = '10px';
        }
    }
}