import { useState, FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@components/atoms';
import clsx from 'clsx';

export interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  showClearButton?: boolean;
  autoFocus?: boolean;
}

export const SearchBar = ({
  value: controlledValue,
  onChange,
  onSearch,
  onClear,
  placeholder = 'Search...',
  disabled = false,
  loading = false,
  className,
  showClearButton = true,
  autoFocus = false,
}: SearchBarProps) => {
  const [internalValue, setInternalValue] = useState('');
  
  // Use controlled value if provided, otherwise use internal state
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const isControlled = controlledValue !== undefined;

  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch?.(value.trim());
    }
  };

  const handleClear = () => {
    handleChange('');
    onClear?.();
  };

  const inputStyles = clsx(
    'w-full px-4 py-2.5 pl-12 pr-20 rounded-lg border transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
    'border-gray-300',
    className
  );

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative">
        {/* Search Icon */}
        <Search 
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          size={20}
        />
        
        {/* Input Field */}
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || loading}
          autoFocus={autoFocus}
          className={inputStyles}
        />
        
        {/* Clear Button */}
        {showClearButton && value && !loading && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
        
        {/* Search Button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={disabled || !value.trim()}
            loading={loading}
          >
            Search
          </Button>
        </div>
      </div>
    </form>
  );
};
