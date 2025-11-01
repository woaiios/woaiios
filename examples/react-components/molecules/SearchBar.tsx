/**
 * SearchBar Component (Molecule)
 * 
 * 搜索栏组件，由 Input 和 Button 组合而成
 * 
 * Features:
 * - 支持受控和非受控模式
 * - 搜索提交（回车或点击按钮）
 * - 加载状态显示
 * - 可自定义占位符
 * 
 * @example
 * ```tsx
 * // 非受控模式
 * <SearchBar onSearch={(query) => console.log(query)} />
 * 
 * // 受控模式
 * const [query, setQuery] = useState('')
 * <SearchBar 
 *   value={query} 
 *   onChange={setQuery}
 *   onSearch={handleSearch}
 *   loading={isSearching}
 * />
 * ```
 */

import { useState, FormEvent, KeyboardEvent } from 'react'
import { Search } from 'lucide-react'

// 假设这些是从 atoms 导入的
import { Input, InputProps } from '../atoms/Input'
import { Button, ButtonProps } from '../atoms/Button'

export interface SearchBarProps {
  /** 搜索值（受控模式） */
  value?: string
  /** 占位符文本 */
  placeholder?: string
  /** 搜索回调 */
  onSearch: (query: string) => void
  /** 值变化回调（受控模式） */
  onChange?: (value: string) => void
  /** 加载状态 */
  loading?: boolean
  /** 自定义类名 */
  className?: string
}

export const SearchBar = ({
  value: controlledValue,
  placeholder = 'Search...',
  onSearch,
  onChange,
  loading = false,
  className,
}: SearchBarProps) => {
  // 非受控模式的内部状态
  const [internalValue, setInternalValue] = useState('')

  // 使用受控值或内部值
  const value = controlledValue ?? internalValue

  // 处理表单提交
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (value.trim()) {
      onSearch(value.trim())
    }
  }

  // 处理输入变化
  const handleChange = (newValue: string) => {
    if (controlledValue === undefined) {
      // 非受控模式：更新内部状态
      setInternalValue(newValue)
    }
    // 调用外部 onChange（如果提供）
    onChange?.(newValue)
  }

  // 处理回车键
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSearch(value.trim())
    }
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`flex gap-2 items-center ${className || ''}`}
      role="search"
    >
      <div className="flex-1">
        <Input
          type="search"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          aria-label="Search input"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        icon={<Search size={18} />}
        loading={loading}
        disabled={!value.trim() || loading}
        aria-label="Submit search"
      >
        Search
      </Button>
    </form>
  )
}

export type { SearchBarProps }
