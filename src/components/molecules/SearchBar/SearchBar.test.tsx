import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('renders with default placeholder', () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<SearchBar placeholder="Search words..." />);
    expect(screen.getByPlaceholderText('Search words...')).toBeInTheDocument();
  });

  it('handles uncontrolled input', () => {
    render(<SearchBar />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'test query' } });
    expect(input).toHaveValue('test query');
  });

  it('handles controlled input', () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <SearchBar value="initial" onChange={handleChange} />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('initial');
    
    fireEvent.change(input, { target: { value: 'updated' } });
    expect(handleChange).toHaveBeenCalledWith('updated');
    
    // Simulate parent updating the value
    rerender(<SearchBar value="updated" onChange={handleChange} />);
    expect(input).toHaveValue('updated');
  });

  it('calls onSearch when form is submitted', () => {
    const handleSearch = vi.fn();
    render(<SearchBar value="test query" onSearch={handleSearch} />);
    
    const form = screen.getByRole('textbox').closest('form')!;
    fireEvent.submit(form);
    
    expect(handleSearch).toHaveBeenCalledWith('test query');
  });

  it('calls onSearch when search button is clicked', () => {
    const handleSearch = vi.fn();
    render(<SearchBar value="test query" onSearch={handleSearch} />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchButton);
    
    expect(handleSearch).toHaveBeenCalledWith('test query');
  });

  it('trims whitespace before calling onSearch', () => {
    const handleSearch = vi.fn();
    render(<SearchBar value="  test query  " onSearch={handleSearch} />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchButton);
    
    expect(handleSearch).toHaveBeenCalledWith('test query');
  });

  it('does not call onSearch when value is empty', () => {
    const handleSearch = vi.fn();
    render(<SearchBar value="" onSearch={handleSearch} />);
    
    const form = screen.getByRole('textbox').closest('form')!;
    fireEvent.submit(form);
    
    expect(handleSearch).not.toHaveBeenCalled();
  });

  it('shows clear button when value is not empty', () => {
    render(<SearchBar value="test" />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchBar value="" />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', () => {
    const handleClear = vi.fn();
    const handleChange = vi.fn();
    render(<SearchBar value="test" onChange={handleChange} onClear={handleClear} />);
    
    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);
    
    expect(handleChange).toHaveBeenCalledWith('');
    expect(handleClear).toHaveBeenCalled();
  });

  it('disables input and buttons when disabled prop is true', () => {
    render(<SearchBar value="test" disabled />);
    
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  it('shows loading state on search button', () => {
    render(<SearchBar value="test" loading />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).toBeDisabled();
    // Loading spinner should be present
    expect(searchButton.querySelector('svg')).toBeInTheDocument();
  });

  it('hides clear button when loading', () => {
    render(<SearchBar value="test" loading />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('disables search button when value is empty or whitespace', () => {
    const { rerender } = render(<SearchBar value="" />);
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    
    rerender(<SearchBar value="   " />);
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    
    rerender(<SearchBar value="test" />);
    expect(screen.getByRole('button', { name: 'Search' })).not.toBeDisabled();
  });

  it('can hide clear button with showClearButton prop', () => {
    render(<SearchBar value="test" showClearButton={false} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('applies autoFocus when specified', () => {
    render(<SearchBar autoFocus />);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});
