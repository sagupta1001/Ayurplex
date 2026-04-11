import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MealRelationshipStep } from '../steps/MealRelationshipStep';

describe('MealRelationshipStep', () => {
  it('renders a labeled option for each of the 4 meal relationships', () => {
    render(
      <MealRelationshipStep data={{}} onNext={() => undefined} onBack={() => undefined} />,
    );
    expect(screen.getByLabelText(/before meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/with meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/after meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/any time/i)).toBeInTheDocument();
  });

  it('calls onNext with the selected meal_relationship', () => {
    const onNext = vi.fn();
    render(<MealRelationshipStep data={{}} onNext={onNext} onBack={() => undefined} />);
    fireEvent.click(screen.getByLabelText(/with meal/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ meal_relationship: 'with' });
  });
});
