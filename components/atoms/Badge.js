/**
 * Badge Atom Component
 * 徽章原子组件 - 可复用的徽章/标签基础组件
 * 
 * Atomic Design Level: Atom (原子)
 * 
 * 功能特性 (Features):
 * - 多种样式变体：default, success, warning, error, info (Multiple style variants)
 * - 支持自定义颜色 (Custom color support)
 * - 支持可关闭徽章 (Closeable badges)
 * 
 * 使用示例 (Usage Example):
 * ```javascript
 * const badge = Badge.create({
 *   text: 'Intermediate',
 *   variant: 'info'
 * });
 * ```
 */

export class Badge {
    /**
     * 创建徽章元素 - Create badge element
     * @param {Object} options - 徽章配置选项 (Badge configuration options)
     * @param {string} options.text - 徽章文本 (Badge text)
     * @param {string} [options.variant='default'] - 样式变体：'default', 'success', 'warning', 'error', 'info' (Style variant)
     * @param {boolean} [options.closeable=false] - 是否可关闭 (Whether closeable)
     * @param {Function} [options.onClose] - 关闭事件处理函数 (Close event handler)
     * @param {string} [options.className=''] - 额外的 CSS 类名 (Additional CSS classes)
     * @param {string} [options.color] - 自定义背景颜色 (Custom background color)
     * @returns {HTMLElement} 徽章 DOM 元素 (Badge DOM element)
     */
    static create(options = {}) {
        const {
            text,
            variant = 'default',
            closeable = false,
            onClose = null,
            className = '',
            color = ''
        } = options;

        const badge = document.createElement('span');
        
        // 设置基础类名 (Set base classes)
        const classes = ['badge', `badge-${variant}`];
        if (className) classes.push(className);
        badge.className = classes.join(' ');

        // 设置文本 (Set text)
        badge.textContent = text;

        // 设置自定义颜色 (Set custom color)
        if (color) {
            badge.style.backgroundColor = color;
        }

        // 添加关闭按钮 (Add close button)
        if (closeable) {
            badge.textContent = ''; // Clear text to add as separate element
            
            const textSpan = document.createElement('span');
            textSpan.textContent = text;
            badge.appendChild(textSpan);

            const closeBtn = document.createElement('span');
            closeBtn.className = 'badge-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onClose && typeof onClose === 'function') {
                    onClose(badge);
                } else {
                    badge.remove();
                }
            });
            badge.appendChild(closeBtn);
        }

        return badge;
    }

    /**
     * 创建难度徽章 - Create difficulty badge
     * @param {string} difficulty - 难度级别：'beginner', 'intermediate', 'advanced', 'expert' (Difficulty level)
     * @returns {HTMLElement} 难度徽章元素 (Difficulty badge element)
     */
    static createDifficultyBadge(difficulty) {
        const variantMap = {
            'beginner': 'success',
            'intermediate': 'info',
            'advanced': 'warning',
            'expert': 'error'
        };

        const labelMap = {
            'beginner': 'Beginner',
            'intermediate': 'Intermediate',
            'advanced': 'Advanced',
            'expert': 'Expert'
        };

        return this.create({
            text: labelMap[difficulty] || difficulty,
            variant: variantMap[difficulty] || 'default'
        });
    }

    /**
     * 更新徽章文本 - Update badge text
     * @param {HTMLElement} badge - 徽章元素 (Badge element)
     * @param {string} text - 新文本 (New text)
     */
    static updateText(badge, text) {
        if (!badge) return;
        
        const textSpan = badge.querySelector('span:not(.badge-close)');
        if (textSpan) {
            textSpan.textContent = text;
        } else {
            badge.textContent = text;
        }
    }
}
