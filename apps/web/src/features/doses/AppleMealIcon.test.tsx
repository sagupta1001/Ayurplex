import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppleMealIcon } from './AppleMealIcon';

describe('AppleMealIcon', () => {
  it('renders before variant with correct label and marker', () => {
    render(<AppleMealIcon relationship="before" />);
    const icon = screen.getByTestId('apple-meal-icon');
    expect(icon).toHaveAttribute('data-relationship', 'before');
    expect(icon).toHaveAttribute('aria-label', 'Take before meal');
    expect(icon).toHaveAttribute('role', 'img');
  });

  it('renders with variant with correct label', () => {
    render(<AppleMealIcon relationship="with" />);
    const icon = screen.getByTestId('apple-meal-icon');
    expect(icon).toHaveAttribute('data-relationship', 'with');
    expect(icon).toHaveAttribute('aria-label', 'Take with meal');
  });

  it('renders after variant with correct label', () => {
    render(<AppleMealIcon relationship="after" />);
    const icon = screen.getByTestId('apple-meal-icon');
    expect(icon).toHaveAttribute('data-relationship', 'after');
    expect(icon).toHaveAttribute('aria-label', 'Take after meal');
  });

  it('renders any variant with muted label', () => {
    render(<AppleMealIcon relationship="any" />);
    const icon = screen.getByTestId('apple-meal-icon');
    expect(icon).toHaveAttribute('data-relationship', 'any');
    expect(icon).toHaveAttribute('aria-label', 'Take any time');
  });

  it('respects custom size prop', () => {
    render(<AppleMealIcon relationship="with" size={48} />);
    const icon = screen.getByTestId('apple-meal-icon');
    expect(icon).toHaveAttribute('width', '48');
    expect(icon).toHaveAttribute('height', '48');
  });

  it('defaults size to 24', () => {
    render(<AppleMealIcon relationship="any" />);
    const icon = screen.getByTestId('apple-meal-icon');
    expect(icon).toHaveAttribute('width', '24');
    expect(icon).toHaveAttribute('height', '24');
  });

  it('allows overriding aria-label via title prop', () => {
    render(<AppleMealIcon relationship="before" title="Custom hint" />);
    const icon = screen.getByTestId('apple-meal-icon');
    expect(icon).toHaveAttribute('aria-label', 'Custom hint');
  });
});
