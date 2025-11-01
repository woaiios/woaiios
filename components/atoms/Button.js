/**
 * Button Atom Component
 * 按钮原子组件 - 可复用的按钮基础组件
 * 
 * Atomic Design Level: Atom (原子)
 * 
 * 功能特性 (Features):
 * - 多种样式变体：primary, secondary, outline, danger, success, info (Multiple style variants)
 * - 支持图标显示 (Icon support)
 * - 支持禁用状态 (Disabled state support)
 * - 支持不同尺寸 (Size variants)
 * - 完全可定制的外观和行为 (Fully customizable appearance and behavior)
 * 
 * 使用示例 (Usage Example):
 * ```javascript
 * const btn = Button.create({
 *   variant: 'primary',
 *   icon: 'fa-search',
 *   text: 'Analyze',
 *   onClick: () => console.log('clicked')
 * });
 * container.appendChild(btn);
 * ```
 */

export class Button {
    /**
     * 创建按钮元素 - Create button element
     * @param {Object} options - 按钮配置选项 (Button configuration options)
     * @param {string} options.variant - 按钮样式变体：'primary', 'secondary', 'outline', 'danger', 'success', 'info' (Button style variant)
     * @param {string} [options.size] - 按钮大小：'sm', 'large' (Button size)
     * @param {string} [options.icon] - Font Awesome 图标类名，如 'fa-search' (Font Awesome icon class)
     * @param {string} [options.text] - 按钮文本 (Button text)
     * @param {Function} [options.onClick] - 点击事件处理函数 (Click event handler)
     * @param {boolean} [options.disabled] - 是否禁用 (Whether disabled)
     * @param {string} [options.id] - 按钮 ID (Button ID)
     * @param {string} [options.className] - 额外的 CSS 类名 (Additional CSS classes)
     * @returns {HTMLButtonElement} 按钮 DOM 元素 (Button DOM element)
     */
    static create(options = {}) {
        const {
            variant = 'primary',
            size = '',
            icon = '',
            text = '',
            onClick = null,
            disabled = false,
            id = '',
            className = ''
        } = options;

        const button = document.createElement('button');
        
        // 设置基础类名 (Set base classes)
        const classes = ['btn', `btn-${variant}`];
        if (size) classes.push(`btn-${size}`);
        if (className) classes.push(className);
        button.className = classes.join(' ');

        // 设置 ID (Set ID)
        if (id) button.id = id;

        // 设置禁用状态 (Set disabled state)
        if (disabled) button.disabled = true;

        // 添加图标和文本 (Add icon and text)
        if (icon) {
            const iconElement = document.createElement('i');
            iconElement.className = `fas ${icon}`;
            button.appendChild(iconElement);
            
            if (text) {
                button.appendChild(document.createTextNode(' '));
            }
        }

        if (text) {
            const textSpan = document.createElement('span');
            textSpan.textContent = text;
            button.appendChild(textSpan);
        }

        // 绑定点击事件 (Bind click event)
        if (onClick && typeof onClick === 'function') {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    /**
     * 更新按钮状态 - Update button state
     * @param {HTMLButtonElement} button - 按钮元素 (Button element)
     * @param {Object} updates - 要更新的属性 (Properties to update)
     * @param {boolean} [updates.disabled] - 禁用状态 (Disabled state)
     * @param {string} [updates.text] - 按钮文本 (Button text)
     */
    static update(button, updates = {}) {
        if (!button) return;

        if (typeof updates.disabled !== 'undefined') {
            button.disabled = updates.disabled;
        }

        if (updates.text) {
            const textSpan = button.querySelector('span');
            if (textSpan) {
                textSpan.textContent = updates.text;
            } else {
                button.textContent = updates.text;
            }
        }
    }

    /**
     * 创建带加载状态的按钮 - Create button with loading state
     * @param {Object} options - 按钮配置选项 (Button configuration options)
     * @returns {Object} 包含按钮元素和控制方法的对象 (Object containing button element and control methods)
     */
    static createWithLoading(options = {}) {
        const button = this.create(options);
        const originalContent = button.innerHTML;

        return {
            element: button,
            setLoading: (loading) => {
                if (loading) {
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                } else {
                    button.disabled = false;
                    button.innerHTML = originalContent;
                }
            }
        };
    }
}
