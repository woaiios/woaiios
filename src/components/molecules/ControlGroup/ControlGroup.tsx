import { ReactNode } from 'react';
import { Input, InputProps, Textarea, TextareaProps, Select, SelectProps } from '@components/atoms';
import clsx from 'clsx';

export interface ControlGroupProps {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  className?: string;
  inline?: boolean;
  children?: ReactNode;
}

export interface InputControlGroupProps extends ControlGroupProps {
  type: 'input';
  inputProps?: Omit<InputProps, 'label' | 'error' | 'helperText'>;
}

export interface TextareaControlGroupProps extends ControlGroupProps {
  type: 'textarea';
  textareaProps?: Omit<TextareaProps, 'label' | 'error' | 'helperText'>;
}

export interface SelectControlGroupProps extends ControlGroupProps {
  type: 'select';
  selectProps: Omit<SelectProps, 'label' | 'error' | 'helperText'>;
}

export interface CheckboxControlGroupProps extends ControlGroupProps {
  type: 'checkbox';
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  checkboxLabel?: string;
}

export type ControlGroupAllProps = 
  | InputControlGroupProps 
  | TextareaControlGroupProps 
  | SelectControlGroupProps 
  | CheckboxControlGroupProps;

export const ControlGroup = (props: ControlGroupAllProps) => {
  const { label, helperText, error, required, className, inline } = props;

  const containerStyles = clsx(
    'w-full',
    inline ? 'flex items-center gap-3' : 'space-y-1',
    className
  );

  const renderControl = () => {
    switch (props.type) {
      case 'input':
        return (
          <Input
            label={label}
            error={error}
            helperText={helperText}
            required={required}
            {...props.inputProps}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            label={label}
            error={error}
            helperText={helperText}
            required={required}
            {...props.textareaProps}
          />
        );
      
      case 'select':
        return (
          <Select
            label={label}
            error={error}
            helperText={helperText}
            required={required}
            {...props.selectProps}
          />
        );
      
      case 'checkbox':
        return (
          <label className={clsx('flex items-center gap-2 cursor-pointer', inline && 'flex-row-reverse')}>
            <input
              type="checkbox"
              checked={props.checked}
              onChange={(e) => props.onChange?.(e.target.checked)}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
            />
            <span className="text-sm font-medium text-gray-700">
              {props.checkboxLabel || label}
              {required && <span className="text-error ml-1">*</span>}
            </span>
          </label>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={containerStyles}>
      {renderControl()}
    </div>
  );
};
