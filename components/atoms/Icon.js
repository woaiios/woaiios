/**
 * Icon Atom Component
 * 图标原子组件 - 可复用的图标基础组件
 * 
 * Atomic Design Level: Atom (原子)
 * 
 * 功能特性 (Features):
 * - 支持 Font Awesome 图标库 (Font Awesome icon library support)
 * - 支持多种尺寸 (Multiple size options)
 * - 支持颜色自定义 (Color customization)
 * - 支持旋转动画 (Spin animation support)
 * 
 * 使用示例 (Usage Example):
 * ```javascript
 * const icon = Icon.create({
 *   name: 'fa-search',
 *   size: 'lg',
 *   color: '#4A90E2'
 * });
 * ```
 */

export class Icon {
    /**
     * 创建图标元素 - Create icon element
     * @param {Object} options - 图标配置选项 (Icon configuration options)
     * @param {string} options.name - Font Awesome 图标名称，如 'fa-search' (Font Awesome icon name)
     * @param {string} [options.size] - 图标大小：'xs', 'sm', 'lg', 'xl', '2x', '3x' 等 (Icon size)
     * @param {string} [options.color] - 图标颜色 (Icon color)
     * @param {boolean} [options.spin=false] - 是否旋转 (Whether to spin)
     * @param {string} [options.className=''] - 额外的 CSS 类名 (Additional CSS classes)
     * @param {string} [options.title] - 图标标题（用于无障碍访问）(Icon title for accessibility)
     * @returns {HTMLElement} 图标 DOM 元素 (Icon DOM element)
     */
    static create(options = {}) {
        const {
            name,
            size = '',
            color = '',
            spin = false,
            className = '',
            title = ''
        } = options;

        if (!name) {
            console.error('Icon name is required');
            return document.createElement('i');
        }

        const icon = document.createElement('i');
        
        // 设置基础类名 (Set base classes)
        const classes = ['fas', name];
        if (size) classes.push(`fa-${size}`);
        if (spin) classes.push('fa-spin');
        if (className) classes.push(className);
        icon.className = classes.join(' ');

        // 设置颜色 (Set color)
        if (color) {
            icon.style.color = color;
        }

        // 设置标题（用于无障碍访问）(Set title for accessibility)
        if (title) {
            icon.title = title;
            icon.setAttribute('aria-label', title);
        }

        return icon;
    }

    /**
     * 创建加载中图标 - Create loading spinner icon
     * @param {Object} options - 配置选项 (Configuration options)
     * @returns {HTMLElement} 旋转的加载图标 (Spinning loader icon)
     */
    static createSpinner(options = {}) {
        return this.create({
            name: 'fa-spinner',
            spin: true,
            ...options
        });
    }

    /**
     * 更新图标 - Update icon
     * @param {HTMLElement} icon - 图标元素 (Icon element)
     * @param {string} newName - 新的图标名称 (New icon name)
     */
    static updateIcon(icon, newName) {
        if (!icon) return;
        
        // 移除旧的图标类名 (Remove old icon class)
        const classes = Array.from(icon.classList);
        classes.forEach(cls => {
            if (cls.startsWith('fa-') && cls !== 'fa-spin' && !cls.match(/^fa-(xs|sm|lg|xl|\d+x)$/)) {
                icon.classList.remove(cls);
            }
        });
        
        // 添加新的图标类名 (Add new icon class)
        icon.classList.add(newName);
    }
}
