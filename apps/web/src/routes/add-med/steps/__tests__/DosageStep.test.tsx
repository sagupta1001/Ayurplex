import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DosageStep } from '../DosageStep';

describe('DosageStep', () => {
  it('submits amount, unit, form and optional instructions', async () => {
    const onNext = vi.fn();
    render(<DosageStep data={{}} onNext={onNext} onBack={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.change(screen.getByLabelText(/^form$/i), { target: { value: 'tablet' } });
    fireEvent.change(screen.getByLabelText(/instructions/i), {
      target: { value: 'with food' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() =>
      expect(onNext).toHaveBeenCalledWith({
        dosage_amount: 500,
        dosage_unit: 'mg',
        form: 'tablet',
        instructions: 'with food',
      }),
    );
  });

  it('shows an error for zero amount', async () => {
    const onNext = vi.fn();
    render(<DosageStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'mg' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/greater than 0/i)).toBeInTheDocument());
    expect(onNext).not.toHaveBeenCalled();
  });
});
