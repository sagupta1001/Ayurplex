import { useState } from 'react';
import type { ReactElement } from 'react';
import type { StepProps } from './types';

type DayIso = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const DAY_LABELS: Array<{ iso: DayIso; label: string }> = [
  { iso: 1, label: 'Monday' },
  { iso: 2, label: 'Tuesday' },
  { iso: 3, label: 'Wednesday' },
  { iso: 4, label: 'Thursday' },
  { iso: 5, label: 'Friday' },
  { iso: 6, label: 'Saturday' },
  { iso: 7, label: 'Sunday' },
];

export function ScheduleStep({ data, onNext, onBack }: StepProps): ReactElement {
  const existingWindow = data.times_of_day?.[0];
  const [start, setStart] = useState(existingWindow?.window_start ?? '');
  const [end, setEnd] = useState(existingWindow?.window_end ?? '');
  const [days, setDays] = useState<DayIso[]>(data.days_of_week ?? []);

  const toggleDay = (iso: DayIso): void => {
    setDays((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort() as DayIso[]));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext({
          frequency: 'daily',
          times_of_day: [{ window_start: start, window_end: end }],
          days_of_week: days,
        });
      }}
    >
      <label>
        Window start
        <input aria-label="Window start" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label>
        Window end
        <input aria-label="Window end" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      {DAY_LABELS.map(({ iso, label }) => (
        <label key={iso}>
          <input
            type="checkbox"
            aria-label={label}
            checked={days.includes(iso)}
            onChange={() => toggleDay(iso)}
          />
          {label}
        </label>
      ))}
      {onBack && (
        <button type="button" onClick={onBack}>
          Back
        </button>
      )}
      <button type="submit">Next</button>
    </form>
  );
}
