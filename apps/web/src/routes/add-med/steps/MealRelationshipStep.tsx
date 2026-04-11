import { useState } from 'react';
import type { ReactElement } from 'react';
import type { StepProps } from './types';

type Meal = 'before' | 'with' | 'after' | 'any';

export function MealRelationshipStep({ data, onNext, onBack }: StepProps): ReactElement {
  const [value, setValue] = useState<Meal>(data.meal_relationship ?? 'any');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext({ meal_relationship: value });
      }}
    >
      <label>
        <input
          type="radio"
          name="meal"
          aria-label="Before meal"
          checked={value === 'before'}
          onChange={() => setValue('before')}
        />
        Before meal
      </label>
      <label>
        <input
          type="radio"
          name="meal"
          aria-label="With meal"
          checked={value === 'with'}
          onChange={() => setValue('with')}
        />
        With meal
      </label>
      <label>
        <input
          type="radio"
          name="meal"
          aria-label="After meal"
          checked={value === 'after'}
          onChange={() => setValue('after')}
        />
        After meal
      </label>
      <label>
        <input
          type="radio"
          name="meal"
          aria-label="Any time"
          checked={value === 'any'}
          onChange={() => setValue('any')}
        />
        Any time
      </label>
      {onBack && (
        <button type="button" onClick={onBack}>
          Back
        </button>
      )}
      <button type="submit">Next</button>
    </form>
  );
}
