import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeStep } from '../WelcomeStep';

describe('WelcomeStep', () => {
  it('renders welcome copy and calls onNext when continue is clicked', async () => {
    const onNext = vi.fn();
    render(<WelcomeStep onNext={onNext} displayName="Satya" />);

    expect(screen.getByText(/welcome to ayurplex/i)).toBeInTheDocument();
    expect(screen.getByText(/satya/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
