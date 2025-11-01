/**
 * ControlGroup Molecule Component
 * 控制组分子组件 - 标签与控件的组合
 * 
 * Atomic Design Level: Molecule (分子)
 * Composition: Label + (Select | Input | Checkbox)
 * 
 * 功能特性 (Features):
 * - 标签与控件的标准化组合 (Standardized label-control pairing)
 * - 支持多种控件类型 (Multiple control types support)
 * - 统一的样式和布局 (Unified styling and layout)
 * 
 * 使用示例 (Usage Example):
 * ```javascript
 * const group = ControlGroup.create({
 *   label: 'Difficulty Level:',
 *   controlType: 'select',
 *   controlOptions: {
 *     id: 'difficultyLevel',
 *     options: [
 *       { value: 'beginner', label: 'Beginner' },
 *       { value: 'intermediate', label: 'Intermediate' }
 *     ]
 *   }
 * });
 * ```
 */

import { Select } from '../atoms/Select.js';
import { Input } from '../atoms/Input.js';

export class ControlGroup {
    /**
     * 创建控制组元素 - Create control group element
     * @param {Object} options - 配置选项 (Configuration options)
     * @param {string} options.label - 标签文本 (Label text)
     * @param {string} [options.controlType='select'] - 控件类型：'select', 'input', 'checkbox' (Control type)
     * @param {Object} [options.controlOptions={}] - 控件的配置选项 (Control configuration options)
     * @param {string} [options.className=''] - 额外的 CSS 类名 (Additional CSS classes)
     * @param {boolean} [options.inline=false] - 是否使用内联布局 (Whether to use inline layout)
     * @returns {HTMLElement} 控制组 DOM 元素 (Control group DOM element)
     */
    static create(options = {}) {
        const {
            label,
            controlType = 'select',
            controlOptions = {},
            className = '',
            inline = false
        } = options;

        const group = document.createElement('div');
        group.className = `control-group ${inline ? 'control-group-inline' : ''} ${className}`.trim();

        // 创建标签 (Create label)
        if (label) {
            const labelElement = document.createElement('label');
            labelElement.textContent = label;
            
            // 如果控件有 ID，关联标签 (Associate label with control if it has ID)
            if (controlOptions.id) {
                labelElement.setAttribute('for', controlOptions.id);
            }
            
            group.appendChild(labelElement);
        }

        // 根据类型创建控件 (Create control based on type)
        let control;
        switch (controlType) {
            case 'select':
                control = Select.create(controlOptions);
                break;
            case 'input':
                control = Input.create(controlOptions);
                break;
            case 'textarea':
                control = Input.createTextarea(controlOptions);
                break;
            case 'checkbox':
                control = this.createCheckbox(controlOptions);
                break;
            default:
                console.error(`Unknown control type: ${controlType}`);
                control = document.createElement('div');
        }

        group.appendChild(control);

        // 存储对控件的引用，方便后续访问 (Store reference to control for easy access)
        group._control = control;

        return group;
    }

    /**
     * 创建复选框控件 - Create checkbox control
     * @param {Object} options - 复选框配置选项 (Checkbox configuration options)
     * @returns {HTMLElement} 复选框容器元素 (Checkbox container element)
     * @private
     */
    static createCheckbox(options = {}) {
        const {
            id = '',
            checked = false,
            onChange = null,
            disabled = false,
            label = ''
        } = options;

        const container = document.createElement('label');
        container.className = 'checkbox-container';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.disabled = disabled;
        if (id) checkbox.id = id;
        
        if (onChange && typeof onChange === 'function') {
            checkbox.addEventListener('change', onChange);
        }

        container.appendChild(checkbox);
        
        if (label) {
            const span = document.createElement('span');
            span.textContent = label;
            container.appendChild(span);
        }

        return container;
    }

    /**
     * 获取控件元素 - Get control element
     * @param {HTMLElement} group - 控制组元素 (Control group element)
     * @returns {HTMLElement} 控件元素 (Control element)
     */
    static getControl(group) {
        return group ? group._control : null;
    }

    /**
     * 获取控件值 - Get control value
     * @param {HTMLElement} group - 控制组元素 (Control group element)
     * @returns {string|boolean} 控件的值 (Control value)
     */
    static getValue(group) {
        const control = this.getControl(group);
        if (!control) return null;

        if (control.type === 'checkbox') {
            return control.checked;
        }
        return control.value;
    }

    /**
     * 设置控件值 - Set control value
     * @param {HTMLElement} group - 控制组元素 (Control group element)
     * @param {string|boolean} value - 要设置的值 (Value to set)
     */
    static setValue(group, value) {
        const control = this.getControl(group);
        if (!control) return;

        if (control.type === 'checkbox') {
            control.checked = value;
        } else {
            control.value = value;
        }
    }
}
