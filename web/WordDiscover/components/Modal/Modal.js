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
        this.element.classList.add('show');
    }

    close() {
        this.element.classList.remove('show');
    }
}
