/**
 * Select Atom Component
 * 下拉选择框原子组件 - 可复用的下拉选择框基础组件
 * 
 * Atomic Design Level: Atom (原子)
 * 
 * 功能特性 (Features):
 * - 支持单选下拉列表 (Single selection dropdown)
 * - 支持选项分组 (Option groups support)
 * - 支持禁用状态 (Disabled state support)
 * - 动态选项更新 (Dynamic option updates)
 * 
 * 使用示例 (Usage Example):
 * ```javascript
 * const select = Select.create({
 *   options: [
 *     { value: 'en', label: 'English' },
 *     { value: 'zh', label: '中文' }
 *   ],
 *   value: 'en',
 *   onChange: (e) => console.log(e.target.value)
 * });
 * ```
 */

export class Select {
    /**
     * 创建下拉选择框元素 - Create select element
     * @param {Object} options - 配置选项 (Configuration options)
     * @param {Array} options.options - 选项数组 (Options array)
     * @param {string} options.options[].value - 选项值 (Option value)
     * @param {string} options.options[].label - 选项标签 (Option label)
     * @param {boolean} [options.options[].selected] - 是否选中 (Whether selected)
     * @param {string} [options.value] - 选中的值 (Selected value)
     * @param {Function} [options.onChange] - 值改变事件处理函数 (Change event handler)
     * @param {boolean} [options.disabled=false] - 是否禁用 (Whether disabled)
     * @param {string} [options.id] - 选择框 ID (Select ID)
     * @param {string} [options.className=''] - 额外的 CSS 类名 (Additional CSS classes)
     * @returns {HTMLSelectElement} 下拉选择框 DOM 元素 (Select DOM element)
     */
    static create(options = {}) {
        const {
            options: selectOptions = [],
            value = '',
            onChange = null,
            disabled = false,
            id = '',
            className = ''
        } = options;

        const select = document.createElement('select');
        select.disabled = disabled;
        
        if (id) select.id = id;
        if (className) select.className = className;

        // 添加选项 (Add options)
        selectOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.selected || opt.value === value) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // 绑定变化事件 (Bind change event)
        if (onChange && typeof onChange === 'function') {
            select.addEventListener('change', onChange);
        }

        return select;
    }

    /**
     * 更新选择框选项 - Update select options
     * @param {HTMLSelectElement} select - 选择框元素 (Select element)
     * @param {Array} options - 新的选项数组 (New options array)
     * @param {string} [selectedValue] - 要选中的值 (Value to select)
     */
    static updateOptions(select, options = [], selectedValue = '') {
        if (!select) return;

        // 清空现有选项 (Clear existing options)
        select.innerHTML = '';

        // 添加新选项 (Add new options)
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    /**
     * 设置选中值 - Set selected value
     * @param {HTMLSelectElement} select - 选择框元素 (Select element)
     * @param {string} value - 要选中的值 (Value to select)
     */
    static setValue(select, value) {
        if (select) {
            select.value = value;
        }
    }

    /**
     * 获取选中值 - Get selected value
     * @param {HTMLSelectElement} select - 选择框元素 (Select element)
     * @returns {string} 选中的值 (Selected value)
     */
    static getValue(select) {
        return select ? select.value : '';
    }

    /**
     * 获取选中的选项对象 - Get selected option object
     * @param {HTMLSelectElement} select - 选择框元素 (Select element)
     * @returns {Object} 选中的选项对象 {value, label} (Selected option object)
     */
    static getSelectedOption(select) {
        if (!select || select.selectedIndex === -1) return null;
        
        const option = select.options[select.selectedIndex];
        return {
            value: option.value,
            label: option.textContent
        };
    }
}
