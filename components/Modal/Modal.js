import { Component } from '../Component.js';

export class Modal extends Component {
    constructor(id, title) {
        super(id);
        this.title = title;
        this.modalContent = null;

        this.element.innerHTML = this.render();
        this.modalContent = this.element.querySelector('.modal-content');

        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });

        const closeBtn = this.element.querySelector('.close-btn');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
    }

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

    open(content) {
        const modalBody = this.element.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = content;
        }
        
        // 触发浏览器重排
        this.element.offsetHeight;
        
        this.element.classList.add('show');
        
        // 在下一帧重新计算位置，确保内容已渲染
        requestAnimationFrame(() => {
            this.calculatePosition();
        });
    }

    close() {
        this.element.classList.remove('show');
    }
    
    calculatePosition() {
        // 预先计算模态框尺寸和位置
        const content = this.modalContent;
        if (!content) return;
        
        // 重置样式以便准确测量
        content.style.marginTop = '';
        content.style.marginBottom = '';
        
        // 强制重排以获取准确尺寸
        content.offsetHeight;
        
        // 获取视窗和内容尺寸
        const viewportHeight = window.innerHeight;
        const contentHeight = content.offsetHeight;
        
        // 计算垂直居中位置，但确保顶部有一定边距
        if (contentHeight < viewportHeight) {
            // 在移动设备上确保顶部边距不小于10px
            const topMargin = Math.max(10, (viewportHeight - contentHeight) / 2);
            content.style.marginTop = `${topMargin}px`;
            content.style.marginBottom = 'auto';
        } else {
            // 如果内容高度超过视窗高度，则顶部对齐并允许滚动
            content.style.marginTop = '10px';
            content.style.marginBottom = '10px';
        }
    }
}