/**
 * Header Component (Organism)
 * 
 * 应用顶部导航栏，包含品牌标识和主要功能按钮
 * 
 * Features:
 * - 响应式设计（桌面/移动）
 * - 粘性定位
 * - 主要功能快捷入口
 * - 可自定义点击事件
 * 
 * @example
 * ```tsx
 * <Header
 *   onVocabularyClick={() => setShowVocabulary(true)}
 *   onSettingsClick={() => setShowSettings(true)}
 *   onPronunciationClick={() => setShowPronunciation(true)}
 * />
 * ```
 */

import { Book, Mic, GraduationCap, Settings } from 'lucide-react'
import { Button } from '../atoms/Button'

export interface HeaderProps {
  /** 词汇本按钮点击事件 */
  onVocabularyClick?: () => void
  /** 设置按钮点击事件 */
  onSettingsClick?: () => void
  /** 发音练习按钮点击事件 */
  onPronunciationClick?: () => void
  /** 自定义类名 */
  className?: string
}

export const Header = ({
  onVocabularyClick,
  onSettingsClick,
  onPronunciationClick,
  className,
}: HeaderProps) => {
  return (
    <header 
      className={`sticky top-0 z-50 bg-white shadow-md ${className || ''}`}
      role="banner"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <Book className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              WordDiscover
            </h1>
          </div>

          {/* Navigation Buttons */}
          <nav className="flex items-center gap-2" aria-label="Main navigation">
            {/* 发音练习按钮 */}
            <Button
              variant="outline"
              size="md"
              icon={<Mic size={18} />}
              onClick={onPronunciationClick}
              aria-label="Open pronunciation practice"
              className="hidden sm:inline-flex"
            >
              <span className="hidden md:inline">Pronunciation</span>
            </Button>

            {/* 词汇本按钮 */}
            <Button
              variant="outline"
              size="md"
              icon={<GraduationCap size={18} />}
              onClick={onVocabularyClick}
              aria-label="Open vocabulary list"
              className="hidden sm:inline-flex"
            >
              <span className="hidden md:inline">Vocabulary</span>
            </Button>

            {/* 设置按钮 */}
            <Button
              variant="outline"
              size="md"
              icon={<Settings size={18} />}
              onClick={onSettingsClick}
              aria-label="Open settings"
            >
              <span className="hidden md:inline">Settings</span>
            </Button>

            {/* Mobile: Icon-only buttons */}
            <div className="flex gap-2 sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                icon={<Mic size={18} />}
                onClick={onPronunciationClick}
                aria-label="Pronunciation"
              >
                {/* Icon only */}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<GraduationCap size={18} />}
                onClick={onVocabularyClick}
                aria-label="Vocabulary"
              >
                {/* Icon only */}
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}

export type { HeaderProps }
