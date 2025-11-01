# React 组件示例 (Component Examples)

这个目录包含了按照 Atomic Design 方法论重构的 React 组件示例。

## 目录结构

```
examples/react-components/
├── atoms/              # 原子组件示例
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   └── ...
├── molecules/          # 分子组件示例
│   ├── SearchBar.tsx
│   ├── WordChip.tsx
│   └── ...
├── organisms/          # 有机体组件示例
│   ├── Header.tsx
│   ├── VocabularyList.tsx
│   └── ...
├── templates/          # 模板示例
│   └── MainTemplate.tsx
└── pages/              # 页面示例
    └── HomePage.tsx
```

## 使用方法

这些示例文件可以直接复制到你的 React 项目中使用。

### 前置条件

确保你的项目已经安装了以下依赖：

```bash
npm install react react-dom
npm install lucide-react clsx
npm install tailwindcss
npm install zustand
npm install framer-motion
```

### 快速开始

1. 复制所需的组件文件到你的项目
2. 根据你的项目结构调整导入路径
3. 根据需要自定义样式和功能

## 组件说明

### Atoms (原子组件)

最基础的 UI 元素，高度可复用，无业务逻辑。

- **Button**: 通用按钮组件，支持多种样式变体
- **Input**: 输入框组件，支持错误提示
- **Badge**: 徽章组件，用于显示标签
- **Spinner**: 加载动画组件

### Molecules (分子组件)

由多个原子组件组合而成，形成简单功能单元。

- **SearchBar**: 搜索栏（Input + Button）
- **WordChip**: 单词标签（Badge + 关闭按钮）
- **StatCard**: 统计卡片（Icon + 数值 + 标签）

### Organisms (有机体组件)

复杂功能区域，实现具体业务功能。

- **Header**: 页面头部导航
- **VocabularyList**: 词汇列表管理
- **TextInputArea**: 文本输入区域

### Templates (模板)

定义页面布局结构。

- **MainTemplate**: 主页面模板（Header + Content + Footer）

### Pages (页面)

具体页面实现。

- **HomePage**: 主页面

## 最佳实践

1. **保持组件职责单一**: 每个组件只做一件事
2. **Props 类型严格**: 使用 TypeScript 定义清晰的接口
3. **样式可定制**: 通过 className 支持外部样式覆盖
4. **可访问性**: 使用语义化 HTML 和 ARIA 属性
5. **性能优化**: 使用 React.memo 和 useMemo 优化渲染

## 相关文档

- [Atomic Design 分析](../../ATOMIC_DESIGN_ANALYSIS.md)
- [React 迁移指南](../../REACT_MIGRATION_GUIDE.md)

## 许可证

MIT
