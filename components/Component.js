/**
 * Base class for UI components.
 */
export class Component {
    constructor(element) {
        if (typeof element === 'string') {
            this.element = document.querySelector(element);
        } else {
            this.element = element;
        }
    }

    addEventListener(selector, event, handler) {
        const element = this.element.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler.bind(this));
        }
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}
