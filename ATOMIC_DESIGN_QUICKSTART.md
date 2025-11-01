# Atomic Design 快速入门指南

> 5分钟了解如何使用 Atomic Design 重构 WordDiscover 项目

---

## 🎯 什么是 Atomic Design？

Atomic Design（原子设计）是一种创建设计系统的方法论，将 UI 组件分为 5 个层级：

```
Atoms (原子) → Molecules (分子) → Organisms (有机体) → Templates (模板) → Pages (页面)
```

就像化学中的元素一样，从最小的单元（原子）逐步组合成复杂的结构（页面）。

---

## 📊 五层架构一览

### 🔹 Layer 1: Atoms (原子)
**最小的 UI 单元，不可再分**

```
Button  Input  Icon  Badge  Checkbox  Tag  Spinner
```

**特点**：
- ✅ 高度可复用
- ✅ 无业务逻辑
- ✅ 纯展示组件
- ✅ 仅接收基础 props

**示例**：
```tsx
<Button variant="primary" onClick={handleClick}>
  Click me
</Button>
```

---

### 🔸 Layer 2: Molecules (分子)
**由多个原子组合，形成简单功能**

```
SearchBar = Input + Button
WordChip = Badge + Icon(close)
StatCard = Icon + Text + Label
```

**特点**：
- ✅ 组合原子组件
- ✅ 简单交互逻辑
- ✅ 可复用于不同场景

**示例**：
```tsx
<SearchBar 
  placeholder="Search words..."
  onSearch={handleSearch}
/>
```

---

### 🔶 Layer 3: Organisms (有机体)
**复杂功能模块，实现具体业务**

```
Header = Logo + Button[] (Vocabulary, Settings, Pronunciation)
VocabularyList = SearchBar + WordCard[] + ActionButtons
TextInputArea = Textarea + Button(Clear) + Button(Analyze)
```

**特点**：
- ✅ 实现业务功能
- ✅ 可能有复杂状态
- ✅ 相对独立模块

**示例**：
```tsx
<Header 
  onVocabularyClick={openVocabulary}
  onSettingsClick={openSettings}
/>
```

---

### 🏗️ Layer 4: Templates (模板)
**定义页面布局，不包含数据**

```
MainTemplate = Header + Main(slot) + Footer
ModalTemplate = ModalHeader + ModalBody(slot) + ModalFooter
```

**特点**：
- ✅ 纯布局组件
- ✅ 使用插槽（children）
- ✅ 响应式布局

**示例**：
```tsx
<MainTemplate>
  <TextInputArea />
  <AnalyzedText />
</MainTemplate>
```

---

### 📄 Layer 5: Pages (页面)
**具体页面，组装所有组件**

```
HomePage = 整合所有功能，管理页面状态
VocabularyModal = 词汇本页面
SettingsModal = 设置页面
```

**特点**：
- ✅ 管理页面状态
- ✅ 协调组件通信
- ✅ 数据获取和处理

**示例**：
```tsx
<HomePage>
  {/* 组装所有 organisms */}
</HomePage>
```

---

## 🎨 WordDiscover 组件拆解

### 当前页面分析

WordDiscover 主页面包含以下功能区域：

```
┌─────────────────────────────────────────────┐
│  Header (导航栏)                              │
├─────────────────────────────────────────────┤
│                                             │
│  TextInputArea (文本输入区)                   │
│  ┌─────────────────────────────────────┐   │
│  │  Textarea                           │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│  [Clear] [Analyze]                         │
│                                             │
│  AnalysisControls (分析控制)                │
│  [Difficulty ▼] [Highlight Mode ▼] [☑ Show] │
│                                             │
│  AnalyzedText (分析结果)                     │
│  The [quick]¹ brown [fox]² jumps...        │
│                                             │
│  Statistics (统计信息)                        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│  │100 │ │ 15 │ │ 8  │ │6.5 │              │
│  │Total│ │High│ │New │ │Diff│              │
│  └────┘ └────┘ └────┘ └────┘              │
│                                             │
│  HighlightedWordsList (高亮词列表)           │
│  • quick [kwɪk] 快速的                      │
│  • fox [fɒks] 狐狸                          │
│                                             │
└─────────────────────────────────────────────┘
```

### 组件层级拆解

```
HomePage (Page)
│
├─ MainTemplate (Template)
│   │
│   ├─ Header (Organism)
│   │   ├─ Logo (Molecule: Icon + Text)
│   │   ├─ Button "Pronunciation" (Atom)
│   │   ├─ Button "Vocabulary" (Atom)
│   │   └─ Button "Settings" (Atom)
│   │
│   ├─ TextInputArea (Organism)
│   │   ├─ Textarea (Atom)
│   │   ├─ Button "Clear" (Atom)
│   │   └─ Button "Analyze" (Atom)
│   │
│   ├─ AnalysisControls (Organism)
│   │   ├─ ControlGroup "Difficulty" (Molecule: Label + Select)
│   │   ├─ ControlGroup "Highlight Mode" (Molecule: Label + Select)
│   │   └─ Checkbox "Show Translations" (Atom)
│   │
│   ├─ AnalyzedTextDisplay (Organism)
│   │   └─ HighlightedWord[] (Molecule: Tooltip + Badge)
│   │
│   ├─ StatisticsPanel (Organism)
│   │   ├─ StatCard "Total Words" (Molecule)
│   │   ├─ StatCard "Highlighted" (Molecule)
│   │   ├─ StatCard "New Words" (Molecule)
│   │   └─ StatCard "Difficulty" (Molecule)
│   │
│   └─ HighlightedWordsList (Organism)
│       └─ WordDefinition[] (Molecule)
│
├─ VocabularyModal (Page)
│   └─ ModalTemplate (Template)
│       └─ VocabularyList (Organism)
│
├─ SettingsModal (Page)
│   └─ ModalTemplate (Template)
│       └─ SettingsPanel (Organism)
│
└─ PronunciationModal (Page)
    └─ ModalTemplate (Template)
        └─ PronunciationPractice (Organism)
```

---

## ⚡ 快速开始（3步骤）

### Step 1: 创建 React 项目

```bash
# 创建项目
npm create vite@latest word-discover-react -- --template react-ts
cd word-discover-react

# 安装依赖
npm install zustand lucide-react clsx framer-motion
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 2: 创建基础组件（从 Atoms 开始）

```bash
mkdir -p src/components/atoms/Button
```

```tsx
// src/components/atoms/Button/Button.tsx
export const Button = ({ variant, children, ...props }) => (
  <button className={`btn btn-${variant}`} {...props}>
    {children}
  </button>
)
```

### Step 3: 逐层组合

```tsx
// Molecule: SearchBar
export const SearchBar = ({ onSearch }) => (
  <div>
    <Input />
    <Button onClick={onSearch}>Search</Button>
  </div>
)

// Organism: Header
export const Header = () => (
  <header>
    <Logo />
    <Button>Vocabulary</Button>
    <Button>Settings</Button>
  </header>
)

// Page: HomePage
export const HomePage = () => (
  <MainTemplate>
    <Header />
    <TextInputArea />
    <AnalyzedText />
  </MainTemplate>
)
```

---

## 📚 推荐技术栈

### 核心库
```bash
npm install react react-dom
npm install zustand              # 状态管理 ⭐
npm install lucide-react         # 图标库 ⭐
npm install framer-motion        # 动画库
npm install react-hook-form      # 表单管理
```

### UI 框架（选择其一）
```bash
# 方案 1：Tailwind CSS（推荐）
npm install -D tailwindcss postcss autoprefixer

# 方案 2：Chakra UI
npm install @chakra-ui/react @emotion/react
```

### 开发工具
```bash
npm install -D @storybook/react-vite    # 组件文档
npm install -D vitest @testing-library/react  # 测试
```

---

## 🎯 数据流设计

### 单向数据流

```
Store (Zustand)
    ↓
  Page
    ↓
Organism
    ↓
Molecule
    ↓
  Atom

Event ↑ (onClick, onChange)
```

### 示例：添加单词到词汇本

```tsx
// 1. Store (状态管理)
const useVocabularyStore = create((set) => ({
  words: [],
  addWord: (word) => set((state) => ({ 
    words: [...state.words, word] 
  }))
}))

// 2. Page (页面状态)
const HomePage = () => {
  const { addWord } = useVocabularyStore()
  
  const handleWordClick = (word) => {
    addWord(word)
  }
  
  return <AnalyzedText onWordClick={handleWordClick} />
}

// 3. Organism (传递回调)
const AnalyzedText = ({ onWordClick }) => {
  return <HighlightedWord onClick={onWordClick} />
}

// 4. Molecule (触发事件)
const HighlightedWord = ({ onClick }) => {
  return <Badge onClick={onClick} />
}

// 5. Atom (最终渲染)
const Badge = ({ onClick }) => {
  return <button onClick={onClick}>Word</button>
}
```

---

## ✅ 开发检查清单

### 组件开发

- [ ] Props 类型定义完整（TypeScript）
- [ ] 组件职责单一清晰
- [ ] 支持自定义 className
- [ ] 添加 JSDoc 注释
- [ ] 编写 Storybook 故事
- [ ] 编写单元测试

### 样式规范

- [ ] 使用设计系统颜色
- [ ] 支持响应式设计
- [ ] 添加过渡动画
- [ ] 支持暗色模式（可选）

### 可访问性

- [ ] 使用语义化 HTML
- [ ] 添加 ARIA 属性
- [ ] 支持键盘导航
- [ ] 足够的颜色对比度

---

## 🚀 迁移时间线

| 周数 | 任务 | 产出 |
|------|------|------|
| Week 1 | 项目搭建 + Atoms | 10+ 基础组件 |
| Week 2 | Molecules + Organisms | 15+ 复合组件 |
| Week 3 | Templates + Pages + 状态管理 | 完整页面 |
| Week 4 | 测试 + 文档 + 部署 | 生产就绪 |

---

## 📖 延伸阅读

1. **详细文档**：
   - [ATOMIC_DESIGN_ANALYSIS.md](./ATOMIC_DESIGN_ANALYSIS.md) - 完整架构分析
   - [REACT_MIGRATION_GUIDE.md](./REACT_MIGRATION_GUIDE.md) - 详细迁移指南

2. **示例代码**：
   - [examples/react-components/](./examples/react-components/) - 组件示例

3. **官方资源**：
   - [Atomic Design Book](https://atomicdesign.bradfrost.com/)
   - [React Docs](https://react.dev/)
   - [Vite Docs](https://vitejs.dev/)

---

## 💡 最佳实践要点

1. **从小到大**：先完成 Atoms，再组合成 Molecules
2. **保持简单**：不要过度抽象，根据实际需求设计
3. **文档优先**：用 Storybook 记录每个组件
4. **测试保障**：关键组件必须有测试覆盖
5. **渐进迁移**：不要一次性重写所有代码

---

## 🤝 需要帮助？

- 查看完整文档：[ATOMIC_DESIGN_ANALYSIS.md](./ATOMIC_DESIGN_ANALYSIS.md)
- 查看迁移指南：[REACT_MIGRATION_GUIDE.md](./REACT_MIGRATION_GUIDE.md)
- 查看示例代码：[examples/react-components/](./examples/react-components/)

---

**开始你的 Atomic Design 之旅！** 🚀
