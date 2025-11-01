# Components - Atomic Design Architecture

本目录采用 **Atomic Design** 方法论组织前端组件，提供清晰的层级结构和高度可复用的组件系统。

This directory follows the **Atomic Design** methodology to organize frontend components, providing a clear hierarchical structure and highly reusable component system.

## 📁 Directory Structure (目录结构)

```
components/
├── atoms/              # 原子组件 - 最小的UI单元
│   ├── Button.js       # 按钮组件
│   ├── Input.js        # 输入框组件
│   ├── Select.js       # 下拉选择框组件
│   ├── Icon.js         # 图标组件
│   ├── Badge.js        # 徽章组件
│   └── index.js        # 统一导出
├── molecules/          # 分子组件 - 原子的简单组合
│   ├── ControlGroup.js # 控制组（标签+控件）
│   └── index.js        # 统一导出
├── organisms/          # 有机体组件 - 复杂的功能模块
│   ├── Modal/          # 模态框组件
│   ├── Vocabulary/     # 词汇管理组件
│   ├── Settings/       # 设置组件
│   ├── AnalyzedText/   # 文本分析展示组件
│   ├── PronunciationChecker/  # 发音检查组件
│   └── index.js        # 统一导出
├── templates/          # 模板 - 页面布局模板（待实现）
└── Component.js        # 基础组件类
```

## 🎯 Atomic Design 层级说明

### 1. Atoms (原子)

**职责**: 最小的UI单元，不可再分的基础组件

**特点**:
- 高度可复用
- 无业务逻辑
- 单一职责
- 纯展示或简单交互

**示例组件**:
- `Button` - 按钮
- `Input` - 输入框
- `Select` - 下拉选择框
- `Icon` - 图标
- `Badge` - 徽章/标签

**使用示例**:
```javascript
import { Button } from './components/atoms/index.js';

const btn = Button.create({
  variant: 'primary',
  icon: 'fa-search',
  text: 'Search',
  onClick: () => console.log('clicked')
});
```

### 2. Molecules (分子)

**职责**: 由多个原子组合成的简单功能组件

**特点**:
- 组合多个原子
- 实现简单的功能
- 保持简洁
- 易于复用

**示例组件**:
- `ControlGroup` - 标签+控件的组合（如: Label + Select）

**使用示例**:
```javascript
import { ControlGroup } from './components/molecules/index.js';

const group = ControlGroup.create({
  label: 'Difficulty:',
  controlType: 'select',
  controlOptions: {
    options: [
      { value: 'easy', label: 'Easy' },
      { value: 'hard', label: 'Hard' }
    ]
  }
});
```

### 3. Organisms (有机体)

**职责**: 由原子、分子组成的复杂功能模块

**特点**:
- 完整的功能模块
- 可能包含业务逻辑
- 相对独立
- 可组合成页面

**示例组件**:
- `Modal` - 模态框（包含标题、内容区、关闭按钮等）
- `VocabularyComponent` - 词汇管理模块
- `SettingsComponent` - 设置管理模块
- `AnalyzedTextComponent` - 文本分析展示模块
- `PronunciationCheckerComponent` - 发音检查模块

**使用示例**:
```javascript
import { VocabularyComponent } from './components/organisms/index.js';

const vocab = new VocabularyComponent(vocabularyManager);
vocab.open();
```

### 4. Templates (模板) - 待实现

**职责**: 页面布局结构，定义组件的位置关系

**特点**:
- 定义页面骨架
- 组织有机体的位置
- 不包含具体内容
- 可重用的布局

### 5. Pages (页面) - 由 app.js 管理

**职责**: 完整的页面实例，填充了真实数据

**特点**:
- 完整的用户界面
- 包含真实数据
- 管理页面状态
- 协调各个组件

## 🔄 组件间的关系

```
Pages (app.js)
    ↓ 使用
Templates (布局模板)
    ↓ 组合
Organisms (功能模块)
    ↓ 使用
Molecules (简单组合)
    ↓ 组合
Atoms (基础组件)
```

## 📦 导入方式

### 方式一: 从index文件导入（推荐）
```javascript
// 导入多个原子组件
import { Button, Input, Icon } from './components/atoms/index.js';

// 导入分子组件
import { ControlGroup } from './components/molecules/index.js';

// 导入有机体组件
import { Modal, VocabularyComponent } from './components/organisms/index.js';
```

### 方式二: 直接导入单个组件
```javascript
import { Button } from './components/atoms/Button.js';
import { ControlGroup } from './components/molecules/ControlGroup.js';
import { Modal } from './components/organisms/Modal/Modal.js';
```

## ✨ 优势

1. **清晰的层级结构**: 组件按功能复杂度分层，易于理解和查找
2. **高度可复用**: 原子和分子组件可在多处使用
3. **易于维护**: 组件职责单一，修改影响范围小
4. **团队协作友好**: 不同成员可并行开发不同层级的组件
5. **测试友好**: 各层组件可独立测试
6. **扩展性强**: 新增组件有明确的归属位置

## 🚀 开发指南

### 创建新的原子组件

1. 在 `atoms/` 目录创建新文件
2. 实现组件的 `create()` 静态方法
3. 添加必要的辅助方法
4. 在 `atoms/index.js` 中导出
5. 编写文档和使用示例

### 创建新的分子组件

1. 在 `molecules/` 目录创建新文件
2. 导入需要的原子组件
3. 组合原子实现新功能
4. 在 `molecules/index.js` 中导出

### 创建新的有机体组件

1. 在 `organisms/` 目录创建新文件夹
2. 实现组件类或函数
3. 使用原子和分子组件构建
4. 在 `organisms/index.js` 中导出

## 📚 参考资源

- [Atomic Design Methodology](https://atomicdesign.bradfrost.com/) - Brad Frost
- [ATOMIC_DESIGN_ANALYSIS.md](../ATOMIC_DESIGN_ANALYSIS.md) - 本项目的详细分析
- [ATOMIC_DESIGN_QUICKSTART.md](../ATOMIC_DESIGN_QUICKSTART.md) - 快速入门指南
- [REACT_MIGRATION_GUIDE.md](../REACT_MIGRATION_GUIDE.md) - React迁移指南（未来参考）

## 🔄 迁移说明

本次重构将原有的扁平组件结构重组为 Atomic Design 架构：

- `components/Modal/` → `components/organisms/Modal/`
- `components/Vocabulary/` → `components/organisms/Vocabulary/`
- `components/Settings/` → `components/organisms/Settings/`
- `components/AnalyzedText/` → `components/organisms/AnalyzedText/`
- `components/PronunciationChecker/` → `components/organisms/PronunciationChecker/`

同时新增了原子和分子组件层，为未来的组件开发提供了更好的基础。

---

**注意**: 本架构基于 Vanilla JavaScript 实现，保持了原有的技术栈。如需迁移到 React，请参考 [REACT_MIGRATION_GUIDE.md](../REACT_MIGRATION_GUIDE.md)。
