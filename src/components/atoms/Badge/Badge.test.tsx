import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders badge with text', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies variant styles', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-success/10');
  });

  it('applies size styles', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('text-xs');
  });

  it('renders close button when closeable', () => {
    render(<Badge closeable onClose={() => {}}>Closeable</Badge>);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<Badge closeable onClose={handleClose}>Closeable</Badge>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when not closeable', () => {
    render(<Badge>Not Closeable</Badge>);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-class">Custom</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('custom-class');
  });
});
