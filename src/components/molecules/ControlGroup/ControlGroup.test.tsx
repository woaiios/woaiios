import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlGroup } from './ControlGroup';

describe('ControlGroup', () => {
  describe('Input type', () => {
    it('renders input with label', () => {
      render(
        <ControlGroup
          type="input"
          label="Username"
          inputProps={{ placeholder: 'Enter username' }}
        />
      );
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
    });

    it('displays error message', () => {
      render(
        <ControlGroup
          type="input"
          label="Email"
          error="Invalid email"
        />
      );
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    it('displays helper text', () => {
      render(
        <ControlGroup
          type="input"
          label="Password"
          helperText="Must be at least 8 characters"
        />
      );
      expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
    });
  });

  describe('Textarea type', () => {
    it('renders textarea with label', () => {
      render(
        <ControlGroup
          type="textarea"
          label="Description"
          textareaProps={{ placeholder: 'Enter description', rows: 4 }}
        />
      );
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });
  });

  describe('Select type', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
    ];

    it('renders select with label', () => {
      render(
        <ControlGroup
          type="select"
          label="Choose option"
          selectProps={{ options }}
        />
      );
      expect(screen.getByLabelText('Choose option')).toBeInTheDocument();
    });

    it('displays select options', () => {
      render(
        <ControlGroup
          type="select"
          label="Choose option"
          selectProps={{ options }}
        />
      );
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });
  });

  describe('Checkbox type', () => {
    it('renders checkbox with label', () => {
      render(
        <ControlGroup
          type="checkbox"
          checkboxLabel="Accept terms"
        />
      );
      expect(screen.getByText('Accept terms')).toBeInTheDocument();
    });

    it('calls onChange when clicked', () => {
      const handleChange = vi.fn();
      render(
        <ControlGroup
          type="checkbox"
          checkboxLabel="Subscribe"
          onChange={handleChange}
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('shows required indicator', () => {
      render(
        <ControlGroup
          type="checkbox"
          checkboxLabel="Required field"
          required
        />
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('applies inline layout when inline prop is true', () => {
      const { container } = render(
        <ControlGroup
          type="input"
          label="Field"
          inline
        />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'items-center');
    });

    it('applies vertical layout by default', () => {
      const { container } = render(
        <ControlGroup
          type="input"
          label="Field"
        />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('space-y-1');
    });
  });
});
