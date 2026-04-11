import { useState } from 'react';
import type { ReactElement } from 'react';
import type { StepProps } from './types';

export function DateRangeStep({ data, onNext, onBack }: StepProps): ReactElement {
  const [startDate, setStartDate] = useState(data.start_date ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext({ start_date: startDate, end_date: null });
      }}
    >
      <label>
        Start date
        <input
          aria-label="Start date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
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
