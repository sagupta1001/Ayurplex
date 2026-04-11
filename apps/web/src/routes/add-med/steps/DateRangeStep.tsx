import { useState } from 'react';
import type { ReactElement } from 'react';
import type { StepProps } from './types';

export function DateRangeStep({ data, onNext, onBack }: StepProps): ReactElement {
  const [start, setStart] = useState(data.start_date ?? '');
  const [end, setEnd] = useState(data.end_date ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleNext = (): void => {
    if (!start) {
      setError('Start date is required');
      return;
    }
    if (end && end < start) {
      setError('End date must be on or after start date');
      return;
    }
    setError(null);
    onNext({ start_date: start, end_date: end === '' ? null : end });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        When does it start and end?
      </h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Start date</span>
        <input
          aria-label="Start date"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>End date (optional)</span>
        <input
          aria-label="End date"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        />
      </label>
      {error && <p style={{ color: '#B3261E', fontSize: 12, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid #007972',
            color: '#007972',
            borderRadius: 999,
            padding: '12px 24px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          style={{
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 999,
            padding: '12px 24px',
            cursor: 'pointer',
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
