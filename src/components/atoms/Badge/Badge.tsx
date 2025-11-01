import { ReactNode } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  closeable?: boolean;
  onClose?: () => void;
  className?: string;
}

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  closeable = false,
  onClose,
  className,
}: BadgeProps) => {
  const baseStyles = 'inline-flex items-center gap-1 rounded-full font-medium';
  
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-orange-700',
    success: 'bg-success/10 text-green-700',
    warning: 'bg-warning/10 text-yellow-700',
    error: 'bg-error/10 text-red-700',
    info: 'bg-blue-50 text-blue-700',
  };
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      <span>{children}</span>
      {closeable && onClose && (
        <button
          onClick={onClose}
          className="hover:opacity-70 transition-opacity focus:outline-none"
          type="button"
          aria-label="Close"
        >
          <X size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />
        </button>
      )}
    </span>
  );
};
