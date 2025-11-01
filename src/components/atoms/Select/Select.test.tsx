import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './Select';

const options = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
];

describe('Select', () => {
  it('renders select with options', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Select options={options} label="Choose an option" />);
    expect(screen.getByLabelText('Choose an option')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<Select options={options} error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('displays helper text', () => {
    render(<Select options={options} helperText="Select one option" />);
    expect(screen.getByText('Select one option')).toBeInTheDocument();
  });

  it('applies error styles when error is present', () => {
    render(<Select options={options} error="Error" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('border-error');
  });

  it('can be disabled', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('sets default value', () => {
    render(<Select options={options} value="option2" onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toHaveValue('option2');
  });
});
