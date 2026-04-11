import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NameStep } from '../NameStep';

describe('NameStep', () => {
  it('calls onNext with the entered name', async () => {
    const onNext = vi.fn();
    render(<NameStep data={{}} onNext={onNext} />);
    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: 'Metformin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(onNext).toHaveBeenCalledWith({ name: 'Metformin' }));
  });

  it('shows an error when submitting an empty name', async () => {
    const onNext = vi.fn();
    render(<NameStep data={{}} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
    );
    expect(onNext).not.toHaveBeenCalled();
  });
});
