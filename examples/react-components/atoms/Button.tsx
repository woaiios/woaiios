/**
 * Button Component (Atom)
 * 
 * 通用按钮组件，支持多种样式变体、大小和状态
 * 
 * Features:
 * - 4 种样式变体：primary, secondary, outline, ghost
 * - 3 种大小：sm, md, lg
 * - 加载状态支持
 * - 图标支持
 * - 完全可访问（ARIA 支持）
 * 
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Click me
 * </Button>
 * 
 * <Button variant="outline" loading>
 *   Loading...
 * </Button>
 * 
 * <Button variant="primary" icon={<Search size={16} />}>
 *   Search
 * </Button>
 * ```
 */

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮样式变体 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 加载状态 */
  loading?: boolean
  /** 图标（显示在文字左侧） */
  icon?: ReactNode
  /** 按钮内容（可选，支持仅图标按钮） */
  children?: ReactNode
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
  // 基础样式
  const baseStyles = clsx(
    'inline-flex items-center justify-center gap-2',
    'rounded-lg font-medium transition-all',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  )

  // 变体样式
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500',
    outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
  }

  // 大小样式
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  // 图标大小
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16

  return (
    <button
      className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={iconSize} aria-hidden="true" />
      ) : (
        icon
      )}
      {children && <span>{children}</span>}
    </button>
  )
}

// 导出类型供其他组件使用
export type { ButtonProps }
