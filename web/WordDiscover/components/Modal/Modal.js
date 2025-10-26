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
        
        // 预先计算并设置模态框位置，避免闪烁
        this.calculatePosition();
        
        // 触发浏览器重排
        this.element.offsetHeight;
        
        this.element.classList.add('show');
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
        
        // 计算垂直居中位置
        if (contentHeight < viewportHeight) {
            const topMargin = (viewportHeight - contentHeight) / 2;
            content.style.marginTop = `${topMargin}px`;
            content.style.marginBottom = 'auto';
        } else {
            // 如果内容高度超过视窗高度，则顶部对齐并允许滚动
            content.style.marginTop = '20px';
            content.style.marginBottom = '20px';
        }
    }
}