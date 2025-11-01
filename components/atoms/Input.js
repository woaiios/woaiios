/**
 * Input Atom Component
 * 输入框原子组件 - 可复用的输入框基础组件
 * 
 * Atomic Design Level: Atom (原子)
 * 
 * 功能特性 (Features):
 * - 支持文本、数字、搜索等多种输入类型 (Multiple input types: text, number, search, etc.)
 * - 支持占位符和标签 (Placeholder and label support)
 * - 支持禁用状态 (Disabled state support)
 * - 支持验证状态 (Validation state support)
 * 
 * 使用示例 (Usage Example):
 * ```javascript
 * const input = Input.create({
 *   type: 'text',
 *   placeholder: 'Enter text...',
 *   value: '',
 *   onChange: (e) => console.log(e.target.value)
 * });
 * ```
 */

export class Input {
    /**
     * 创建输入框元素 - Create input element
     * @param {Object} options - 输入框配置选项 (Input configuration options)
     * @param {string} [options.type='text'] - 输入类型 (Input type)
     * @param {string} [options.value=''] - 输入值 (Input value)
     * @param {string} [options.placeholder=''] - 占位符文本 (Placeholder text)
     * @param {Function} [options.onChange] - 值改变事件处理函数 (Change event handler)
     * @param {Function} [options.onInput] - 输入事件处理函数 (Input event handler)
     * @param {boolean} [options.disabled=false] - 是否禁用 (Whether disabled)
     * @param {string} [options.id] - 输入框 ID (Input ID)
     * @param {string} [options.className=''] - 额外的 CSS 类名 (Additional CSS classes)
     * @param {number} [options.min] - 最小值（用于 number 类型）(Minimum value for number type)
     * @param {number} [options.max] - 最大值（用于 number 类型）(Maximum value for number type)
     * @param {number} [options.step] - 步长（用于 number 类型）(Step for number type)
     * @returns {HTMLInputElement} 输入框 DOM 元素 (Input DOM element)
     */
    static create(options = {}) {
        const {
            type = 'text',
            value = '',
            placeholder = '',
            onChange = null,
            onInput = null,
            disabled = false,
            id = '',
            className = '',
            min = undefined,
            max = undefined,
            step = undefined
        } = options;

        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.placeholder = placeholder;
        input.disabled = disabled;
        
        if (id) input.id = id;
        if (className) input.className = className;
        if (min !== undefined) input.min = min;
        if (max !== undefined) input.max = max;
        if (step !== undefined) input.step = step;

        // 绑定事件 (Bind events)
        if (onChange && typeof onChange === 'function') {
            input.addEventListener('change', onChange);
        }
        if (onInput && typeof onInput === 'function') {
            input.addEventListener('input', onInput);
        }

        return input;
    }

    /**
     * 创建文本区域元素 - Create textarea element
     * @param {Object} options - 文本区域配置选项 (Textarea configuration options)
     * @param {string} [options.value=''] - 文本值 (Text value)
     * @param {string} [options.placeholder=''] - 占位符文本 (Placeholder text)
     * @param {number} [options.rows=4] - 行数 (Number of rows)
     * @param {Function} [options.onChange] - 值改变事件处理函数 (Change event handler)
     * @param {Function} [options.onInput] - 输入事件处理函数 (Input event handler)
     * @param {boolean} [options.disabled=false] - 是否禁用 (Whether disabled)
     * @param {string} [options.id] - 文本区域 ID (Textarea ID)
     * @param {string} [options.className=''] - 额外的 CSS 类名 (Additional CSS classes)
     * @returns {HTMLTextAreaElement} 文本区域 DOM 元素 (Textarea DOM element)
     */
    static createTextarea(options = {}) {
        const {
            value = '',
            placeholder = '',
            rows = 4,
            onChange = null,
            onInput = null,
            disabled = false,
            id = '',
            className = ''
        } = options;

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.placeholder = placeholder;
        textarea.rows = rows;
        textarea.disabled = disabled;
        
        if (id) textarea.id = id;
        if (className) textarea.className = className;

        // 绑定事件 (Bind events)
        if (onChange && typeof onChange === 'function') {
            textarea.addEventListener('change', onChange);
        }
        if (onInput && typeof onInput === 'function') {
            textarea.addEventListener('input', onInput);
        }

        return textarea;
    }

    /**
     * 更新输入框值 - Update input value
     * @param {HTMLInputElement|HTMLTextAreaElement} input - 输入框元素 (Input element)
     * @param {string} value - 新值 (New value)
     */
    static setValue(input, value) {
        if (input) {
            input.value = value;
        }
    }

    /**
     * 获取输入框值 - Get input value
     * @param {HTMLInputElement|HTMLTextAreaElement} input - 输入框元素 (Input element)
     * @returns {string} 输入框的值 (Input value)
     */
    static getValue(input) {
        return input ? input.value : '';
    }

    /**
     * 设置输入框状态 - Set input state
     * @param {HTMLInputElement|HTMLTextAreaElement} input - 输入框元素 (Input element)
     * @param {Object} state - 状态对象 (State object)
     * @param {boolean} [state.disabled] - 禁用状态 (Disabled state)
     * @param {string} [state.placeholder] - 占位符 (Placeholder)
     */
    static setState(input, state = {}) {
        if (!input) return;

        if (typeof state.disabled !== 'undefined') {
            input.disabled = state.disabled;
        }
        if (state.placeholder !== undefined) {
            input.placeholder = state.placeholder;
        }
    }
}
