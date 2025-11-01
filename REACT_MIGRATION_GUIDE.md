# React 迁移实施指南

## 快速开始

本指南提供从当前 Vanilla JavaScript + Vite 项目迁移到 React + Atomic Design 架构的详细步骤。

---

## 阶段 1: 项目初始化

### 1.1 创建新的 React 项目

```bash
# 使用 Vite 创建 React + TypeScript 项目
npm create vite@latest word-discover-react -- --template react-ts

cd word-discover-react
npm install
```

### 1.2 安装核心依赖

```bash
# React 核心库（已包含在模板中）
# npm install react react-dom

# 状态管理 - Zustand（推荐）
npm install zustand

# 持久化中间件
npm install zustand/middleware

# UI 框架 - Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 图标库
npm install lucide-react

# 工具库
npm install clsx
npm install date-fns

# 动画库
npm install framer-motion

# 数据请求（如需要）
npm install @tanstack/react-query

# 表单管理
npm install react-hook-form

# 数据库相关（保留原项目）
npm install sql.js pako

# 词形还原（保留原项目）
npm install wink-lemmatizer
```

### 1.3 开发工具

```bash
# Storybook
npx storybook@latest init

# 测试工具
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# ESLint 和 Prettier
npm install -D eslint prettier eslint-plugin-react eslint-plugin-react-hooks

# TypeScript 类型
npm install -D @types/sql.js
```

### 1.4 配置 Tailwind CSS

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4A90E2',
        secondary: '#F5A623',
        success: '#7ED321',
        warning: '#F8E71C',
        error: '#D0021B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}
```

### 1.5 配置 Vitest

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/woaiios/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

---

## 阶段 2: 创建基础组件（Atoms）

### 2.1 Button 组件

```typescript
// src/components/atoms/Button/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantStyles = {
    primary: 'bg-primary text-white hover:bg-blue-600 focus:ring-primary',
    secondary: 'bg-secondary text-white hover:bg-orange-600 focus:ring-secondary',
    outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
  }
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : icon}
      <span>{children}</span>
    </button>
  )
}
```

```typescript
// src/components/atoms/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Search } from 'lucide-react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
}

export const WithIcon: Story = {
  args: {
    variant: 'primary',
    icon: <Search size={16} />,
    children: 'Search',
  },
}

export const Loading: Story = {
  args: {
    variant: 'primary',
    loading: true,
    children: 'Loading...',
  },
}
```

```typescript
// src/components/atoms/Button/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disables button when loading', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-secondary')
  })
})
```

### 2.2 Input 组件

```typescript
// src/components/atoms/Input/Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            error ? 'border-error' : 'border-gray-300',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-error">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
```

### 2.3 Textarea 组件

```typescript
// src/components/atoms/Textarea/Textarea.tsx
import { TextareaHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, label, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg transition-colors resize-vertical',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            error ? 'border-error' : 'border-gray-300',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-error">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
```

### 2.4 导出所有 Atoms

```typescript
// src/components/atoms/index.ts
export { Button } from './Button/Button'
export type { ButtonProps } from './Button/Button'

export { Input } from './Input/Input'
export type { InputProps } from './Input/Input'

export { Textarea } from './Textarea/Textarea'
export type { TextareaProps } from './Textarea/Textarea'

export { Select } from './Select/Select'
export type { SelectProps } from './Select/Select'

export { Checkbox } from './Checkbox/Checkbox'
export type { CheckboxProps } from './Checkbox/Checkbox'

export { Badge } from './Badge/Badge'
export type { BadgeProps } from './Badge/Badge'

export { Spinner } from './Spinner/Spinner'
export type { SpinnerProps } from './Spinner/Spinner'

export { ProgressBar } from './ProgressBar/ProgressBar'
export type { ProgressBarProps } from './ProgressBar/ProgressBar'
```

---

## 阶段 3: 状态管理

### 3.1 Zustand Store - 词汇管理

```typescript
// src/store/vocabularyStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Word {
  id: string
  word: string
  translation: string
  phonetic?: string
  collins?: number
  tags?: string[]
  addedAt: number
}

interface VocabularyState {
  words: Word[]
  addWord: (word: Omit<Word, 'id' | 'addedAt'>) => void
  removeWord: (id: string) => void
  clearWords: () => void
  searchWords: (query: string) => Word[]
  hasWord: (word: string) => boolean
}

export const useVocabularyStore = create<VocabularyState>()(
  persist(
    (set, get) => ({
      words: [],
      
      addWord: (wordData) => {
        const newWord: Word = {
          ...wordData,
          id: crypto.randomUUID(),
          addedAt: Date.now(),
        }
        set((state) => ({
          words: [...state.words, newWord],
        }))
      },
      
      removeWord: (id) => {
        set((state) => ({
          words: state.words.filter((w) => w.id !== id),
        }))
      },
      
      clearWords: () => {
        set({ words: [] })
      },
      
      searchWords: (query) => {
        const { words } = get()
        const lowerQuery = query.toLowerCase()
        return words.filter(
          (w) =>
            w.word.toLowerCase().includes(lowerQuery) ||
            w.translation.toLowerCase().includes(lowerQuery)
        )
      },
      
      hasWord: (word) => {
        const { words } = get()
        return words.some((w) => w.word.toLowerCase() === word.toLowerCase())
      },
    }),
    {
      name: 'vocabulary-storage',
    }
  )
)
```

### 3.2 Zustand Store - 设置管理

```typescript
// src/store/settingsStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Settings {
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  highlightMode: 'unknown' | 'difficult' | 'all'
  showTranslations: boolean
  highlightColors: {
    beginner: string
    intermediate: string
    advanced: string
    expert: string
  }
  translationService: 'google' | 'deepl' | 'bing'
  targetLanguage: string
}

interface SettingsState {
  settings: Settings
  updateSettings: (settings: Partial<Settings>) => void
  resetSettings: () => void
}

const defaultSettings: Settings = {
  difficulty: 'intermediate',
  highlightMode: 'difficult',
  showTranslations: true,
  highlightColors: {
    beginner: '#7ED321',
    intermediate: '#F8E71C',
    advanced: '#F5A623',
    expert: '#D0021B',
  },
  translationService: 'google',
  targetLanguage: 'zh-CN',
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }))
      },
      
      resetSettings: () => {
        set({ settings: defaultSettings })
      },
    }),
    {
      name: 'settings-storage',
    }
  )
)
```

---

## 阶段 4: 自定义 Hooks

### 4.1 useTextAnalyzer Hook

```typescript
// src/hooks/useTextAnalyzer.ts
import { useState, useCallback } from 'react'
import { TextAnalyzer } from '@/services/TextAnalyzer'
import { useDatabase } from './useDatabase'

export interface AnalysisResult {
  words: Array<{
    word: string
    difficulty: string
    translation?: string
    isKnown: boolean
  }>
  statistics: {
    totalWords: number
    highlightedWords: number
    newWords: number
    difficultyScore: number
  }
}

export const useTextAnalyzer = () => {
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { database } = useDatabase()

  const analyze = useCallback(
    async (text: string, settings: any) => {
      if (!database) {
        setError('Database not ready')
        return
      }

      setAnalyzing(true)
      setError(null)

      try {
        const analyzer = new TextAnalyzer(database)
        const result = await analyzer.analyze(text, settings)
        setResult(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed')
      } finally {
        setAnalyzing(false)
      }
    },
    [database]
  )

  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    analyzing,
    result,
    error,
    analyze,
    clear,
  }
}
```

### 4.2 useDatabase Hook

```typescript
// src/hooks/useDatabase.ts
import { useState, useEffect } from 'react'
import { WordDatabase } from '@/services/WordDatabase'

export const useDatabase = () => {
  const [database, setDatabase] = useState<WordDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initDatabase = async () => {
      try {
        const db = new WordDatabase()
        
        db.setProgressCallback((data) => {
          setProgress(data.percentage)
        })

        await db.initialize()
        setDatabase(db)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load database')
      } finally {
        setLoading(false)
      }
    }

    initDatabase()
  }, [])

  return {
    database,
    loading,
    progress,
    error,
  }
}
```

### 4.3 useModal Hook

```typescript
// src/hooks/useModal.ts
import { useState, useCallback } from 'react'

export const useModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState)

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}
```

---

## 阶段 5: 服务层迁移

### 5.1 复制和调整现有服务

```typescript
// src/services/WordDatabase.ts
// 从原项目的 js/WordDatabase.js 迁移
// 保持核心逻辑不变，调整为 TypeScript

export class WordDatabase {
  // ... 保持原有实现
}
```

```typescript
// src/services/TextAnalyzer.ts
// 从原项目的 js/TextAnalyzer.js 迁移

export class TextAnalyzer {
  // ... 保持原有实现
}
```

---

## 阶段 6: 页面组装

### 6.1 HomePage

```typescript
// src/pages/HomePage/HomePage.tsx
import { useState } from 'react'
import { Header } from '@/components/organisms/Header'
import { TextInputArea } from '@/components/organisms/TextInputArea'
import { AnalysisControls } from '@/components/organisms/AnalysisControls'
import { AnalyzedTextDisplay } from '@/components/organisms/AnalyzedTextDisplay'
import { StatisticsPanel } from '@/components/organisms/StatisticsPanel'
import { VocabularyModal } from '@/pages/VocabularyModal'
import { SettingsModal } from '@/pages/SettingsModal'
import { PronunciationModal } from '@/pages/PronunciationModal'
import { DatabaseLoadingOverlay } from '@/components/organisms/DatabaseLoadingOverlay'
import { useTextAnalyzer } from '@/hooks/useTextAnalyzer'
import { useDatabase } from '@/hooks/useDatabase'
import { useSettingsStore } from '@/store/settingsStore'
import { useModal } from '@/hooks/useModal'

export const HomePage = () => {
  const [inputText, setInputText] = useState('')
  const { settings, updateSettings } = useSettingsStore()
  const { database, loading: dbLoading, progress } = useDatabase()
  const { analyzing, result, analyze, clear } = useTextAnalyzer()
  
  const vocabularyModal = useModal()
  const settingsModal = useModal()
  const pronunciationModal = useModal()

  const handleAnalyze = async () => {
    if (inputText.trim()) {
      await analyze(inputText, settings)
    }
  }

  const handleClear = () => {
    setInputText('')
    clear()
  }

  return (
    <>
      <DatabaseLoadingOverlay visible={dbLoading} progress={progress} />
      
      <div className="min-h-screen flex flex-col">
        <Header
          onVocabularyClick={vocabularyModal.open}
          onSettingsClick={settingsModal.open}
          onPronunciationClick={pronunciationModal.open}
        />

        <main className="flex-1 container mx-auto px-4 py-8">
          <TextInputArea
            text={inputText}
            onTextChange={setInputText}
            onClear={handleClear}
            onAnalyze={handleAnalyze}
            loading={analyzing}
          />

          <AnalysisControls
            settings={settings}
            onSettingsChange={updateSettings}
          />

          {result && (
            <>
              <AnalyzedTextDisplay
                result={result}
                showTranslations={settings.showTranslations}
              />
              <StatisticsPanel statistics={result.statistics} />
            </>
          )}
        </main>
      </div>

      <VocabularyModal isOpen={vocabularyModal.isOpen} onClose={vocabularyModal.close} />
      <SettingsModal isOpen={settingsModal.isOpen} onClose={settingsModal.close} />
      <PronunciationModal isOpen={pronunciationModal.isOpen} onClose={pronunciationModal.close} />
    </>
  )
}
```

---

## 阶段 7: 测试

### 7.1 测试配置

```typescript
// src/test/setup.ts
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(() => {
  cleanup()
})
```

### 7.2 运行测试

```bash
# 运行所有测试
npm run test

# 运行测试（监听模式）
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

---

## 阶段 8: 部署

### 8.1 构建配置

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

### 8.2 GitHub Pages 部署

```bash
# 构建生产版本
npm run build

# 部署到 GitHub Pages
# (配置 GitHub Actions 或使用 gh-pages 工具)
```

---

## 完整迁移检查清单

- [ ] ✅ 项目初始化完成
- [ ] ✅ 所有依赖安装完成
- [ ] ✅ Tailwind CSS 配置完成
- [ ] ✅ TypeScript 配置完成
- [ ] ✅ Storybook 配置完成
- [ ] ✅ 测试框架配置完成
- [ ] ✅ 所有 Atoms 组件创建完成
- [ ] ✅ 所有 Molecules 组件创建完成
- [ ] ✅ 所有 Organisms 组件创建完成
- [ ] ✅ 所有 Templates 组件创建完成
- [ ] ✅ 所有 Pages 组件创建完成
- [ ] ✅ 状态管理实现完成
- [ ] ✅ 自定义 Hooks 创建完成
- [ ] ✅ 服务层迁移完成
- [ ] ✅ 样式系统实现完成
- [ ] ✅ 单元测试编写完成
- [ ] ✅ Storybook 文档完成
- [ ] ✅ 集成测试完成
- [ ] ✅ 性能优化完成
- [ ] ✅ 构建配置完成
- [ ] ✅ 部署配置完成

---

**预计完成时间**: 3-4 周（2-3 人团队）

**下一步**: 参考 [ATOMIC_DESIGN_ANALYSIS.md](./ATOMIC_DESIGN_ANALYSIS.md) 了解详细的架构设计。
