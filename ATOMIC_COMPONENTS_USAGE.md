# Atomic Components Usage Examples

本文档提供了如何使用新的原子和分子组件的实际示例。

This document provides practical examples of how to use the new atomic and molecular components.

## 📦 导入组件 (Importing Components)

### 方式一：从 index 文件统一导入（推荐）
```javascript
// 导入原子组件
import { Button, Input, Select, Icon, Badge } from './components/atoms/index.js';

// 导入分子组件
import { ControlGroup } from './components/molecules/index.js';
```

### 方式二：直接导入单个组件
```javascript
import { Button } from './components/atoms/Button.js';
import { ControlGroup } from './components/molecules/ControlGroup.js';
```

## 🔹 原子组件使用示例 (Atom Component Examples)

### Button (按钮)

```javascript
import { Button } from './components/atoms/Button.js';

// 创建主要按钮
const primaryBtn = Button.create({
    variant: 'primary',
    text: 'Analyze Text',
    icon: 'fa-search',
    onClick: () => {
        console.log('Button clicked!');
    }
});

// 创建次要按钮
const secondaryBtn = Button.create({
    variant: 'secondary',
    text: 'Clear',
    icon: 'fa-trash'
});

// 创建轮廓按钮
const outlineBtn = Button.create({
    variant: 'outline',
    text: 'Settings',
    icon: 'fa-cog'
});

// 创建小尺寸按钮
const smallBtn = Button.create({
    variant: 'primary',
    size: 'sm',
    text: 'Delete',
    icon: 'fa-trash'
});

// 创建带加载状态的按钮
const loadingBtn = Button.createWithLoading({
    variant: 'primary',
    text: 'Submit',
    onClick: async () => {
        loadingBtn.setLoading(true);
        await someAsyncOperation();
        loadingBtn.setLoading(false);
    }
});

// 更新按钮状态
Button.update(primaryBtn, {
    disabled: true,
    text: 'Processing...'
});

// 将按钮添加到 DOM
document.getElementById('container').appendChild(primaryBtn);
```

### Input (输入框)

```javascript
import { Input } from './components/atoms/Input.js';

// 创建文本输入框
const textInput = Input.create({
    type: 'text',
    placeholder: 'Enter your name...',
    value: '',
    onChange: (e) => {
        console.log('Value changed:', e.target.value);
    }
});

// 创建搜索输入框
const searchInput = Input.create({
    type: 'search',
    placeholder: 'Search words...',
    id: 'searchBox',
    className: 'search-input'
});

// 创建数字输入框
const numberInput = Input.create({
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    value: 50
});

// 创建文本区域
const textarea = Input.createTextarea({
    placeholder: 'Paste your English text here...',
    rows: 10,
    onInput: (e) => {
        console.log('Text length:', e.target.value.length);
    }
});

// 获取和设置值
Input.setValue(textInput, 'John Doe');
const value = Input.getValue(textInput);

// 设置状态
Input.setState(textInput, {
    disabled: false,
    placeholder: 'New placeholder'
});
```

### Select (下拉选择框)

```javascript
import { Select } from './components/atoms/Select.js';

// 创建下拉选择框
const difficultySelect = Select.create({
    id: 'difficultyLevel',
    options: [
        { value: 'beginner', label: 'Beginner' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'advanced', label: 'Advanced' },
        { value: 'expert', label: 'Expert' }
    ],
    value: 'intermediate',
    onChange: (e) => {
        console.log('Selected:', e.target.value);
    }
});

// 更新选项
Select.updateOptions(difficultySelect, [
    { value: 'easy', label: 'Easy' },
    { value: 'hard', label: 'Hard' }
], 'easy');

// 获取和设置值
Select.setValue(difficultySelect, 'advanced');
const selectedValue = Select.getValue(difficultySelect);
const selectedOption = Select.getSelectedOption(difficultySelect);
console.log(selectedOption); // { value: 'advanced', label: 'Advanced' }
```

### Icon (图标)

```javascript
import { Icon } from './components/atoms/Icon.js';

// 创建基本图标
const searchIcon = Icon.create({
    name: 'fa-search'
});

// 创建带尺寸的图标
const largeIcon = Icon.create({
    name: 'fa-heart',
    size: 'lg',
    color: '#ff0000'
});

// 创建旋转图标（加载动画）
const spinnerIcon = Icon.create({
    name: 'fa-spinner',
    spin: true
});

// 或使用便捷方法
const loadingIcon = Icon.createSpinner({
    size: '2x'
});

// 更新图标
Icon.updateIcon(searchIcon, 'fa-check');
```

### Badge (徽章)

```javascript
import { Badge } from './components/atoms/Badge.js';

// 创建基本徽章
const badge = Badge.create({
    text: 'New',
    variant: 'success'
});

// 创建不同变体的徽章
const infoBadge = Badge.create({ text: 'Info', variant: 'info' });
const warningBadge = Badge.create({ text: 'Warning', variant: 'warning' });
const errorBadge = Badge.create({ text: 'Error', variant: 'error' });

// 创建可关闭的徽章
const closeableBadge = Badge.create({
    text: 'Closeable',
    variant: 'default',
    closeable: true,
    onClose: (badge) => {
        console.log('Badge closed');
        badge.remove();
    }
});

// 创建难度徽章
const difficultyBadge = Badge.createDifficultyBadge('intermediate');

// 更新徽章文本
Badge.updateText(badge, 'Updated');
```

## 🔸 分子组件使用示例 (Molecule Component Examples)

### ControlGroup (控制组)

```javascript
import { ControlGroup } from './components/molecules/ControlGroup.js';

// 创建带下拉选择框的控制组
const difficultyGroup = ControlGroup.create({
    label: 'Difficulty Level:',
    controlType: 'select',
    controlOptions: {
        id: 'difficultyLevel',
        options: [
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
            { value: 'expert', label: 'Expert' }
        ],
        value: 'intermediate',
        onChange: (e) => {
            console.log('Difficulty changed:', e.target.value);
        }
    }
});

// 创建带输入框的控制组
const nameGroup = ControlGroup.create({
    label: 'Your Name:',
    controlType: 'input',
    controlOptions: {
        type: 'text',
        placeholder: 'Enter your name...',
        value: ''
    }
});

// 创建带复选框的控制组（内联布局）
const checkboxGroup = ControlGroup.create({
    label: '',
    controlType: 'checkbox',
    inline: true,
    controlOptions: {
        id: 'showTranslations',
        checked: true,
        label: 'Show Translations on Hover',
        onChange: (e) => {
            console.log('Checkbox changed:', e.target.checked);
        }
    }
});

// 创建带文本区域的控制组
const textGroup = ControlGroup.create({
    label: 'Description:',
    controlType: 'textarea',
    controlOptions: {
        rows: 5,
        placeholder: 'Enter description...'
    }
});

// 获取控件值
const value = ControlGroup.getValue(difficultyGroup);
console.log('Current value:', value);

// 设置控件值
ControlGroup.setValue(difficultyGroup, 'expert');

// 获取控件元素本身（用于更高级的操作）
const control = ControlGroup.getControl(difficultyGroup);
```

## 🎨 实际应用场景 (Real-World Use Cases)

### 场景一：创建表单

```javascript
import { ControlGroup } from './components/molecules/ControlGroup.js';
import { Button } from './components/atoms/Button.js';

// 创建表单容器
const form = document.createElement('form');
form.className = 'settings-form';

// 添加控制组
const nameGroup = ControlGroup.create({
    label: 'Name:',
    controlType: 'input',
    controlOptions: { type: 'text', placeholder: 'Your name' }
});

const levelGroup = ControlGroup.create({
    label: 'Level:',
    controlType: 'select',
    controlOptions: {
        options: [
            { value: 'beginner', label: 'Beginner' },
            { value: 'advanced', label: 'Advanced' }
        ]
    }
});

const submitBtn = Button.create({
    variant: 'primary',
    text: 'Submit',
    type: 'submit'
});

// 组装表单
form.appendChild(nameGroup);
form.appendChild(levelGroup);
form.appendChild(submitBtn);

// 添加到页面
document.getElementById('container').appendChild(form);
```

### 场景二：创建工具栏

```javascript
import { Button } from './components/atoms/Button.js';

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';

const buttons = [
    { variant: 'primary', icon: 'fa-plus', text: 'Add' },
    { variant: 'secondary', icon: 'fa-edit', text: 'Edit' },
    { variant: 'danger', icon: 'fa-trash', text: 'Delete' }
];

buttons.forEach(btnConfig => {
    const btn = Button.create({
        ...btnConfig,
        onClick: () => console.log(`${btnConfig.text} clicked`)
    });
    toolbar.appendChild(btn);
});
```

### 场景三：创建状态卡片

```javascript
import { Badge } from './components/atoms/Badge.js';
import { Icon } from './components/atoms/Icon.js';

const card = document.createElement('div');
card.className = 'stat-card';

const icon = Icon.create({ name: 'fa-book', size: '2x', color: '#4A90E2' });
const value = document.createElement('div');
value.className = 'stat-value';
value.textContent = '1,234';
const label = document.createElement('div');
label.className = 'stat-label';
label.textContent = 'Words Learned';
const badge = Badge.create({ text: 'Active', variant: 'success' });

card.appendChild(icon);
card.appendChild(value);
card.appendChild(label);
card.appendChild(badge);
```

## 💡 最佳实践 (Best Practices)

1. **使用统一导入**: 从 index.js 文件导入多个组件，保持代码整洁
2. **保持原子性**: 原子组件应该保持简单，只负责单一功能
3. **组合优于继承**: 使用分子组件组合原子组件，而不是修改原子组件
4. **事件委托**: 在父元素上监听事件，而不是在每个子元素上
5. **状态管理**: 使用组件提供的 update/setState 方法更新状态
6. **ID 和类名**: 为需要访问的元素提供 ID，为样式提供类名

## 📚 参考资源

- [components/README.md](./components/README.md) - 完整的组件架构文档
- [ATOMIC_DESIGN_ANALYSIS.md](./ATOMIC_DESIGN_ANALYSIS.md) - Atomic Design 分析
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 应用架构文档
