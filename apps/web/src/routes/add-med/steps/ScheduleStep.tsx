import { useState } from 'react';
import type { ReactElement } from 'react';
import type { DayOfWeek, TimeWindow } from '@ayurplex/shared';
import type { StepProps } from './types';

interface DayLabel {
  value: DayOfWeek;
  label: string;
}

const DAY_LABELS: DayLabel[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

export function ScheduleStep({ data, onNext, onBack }: StepProps): ReactElement {
  const initial: TimeWindow = data.times_of_day?.[0] ?? {
    window_start: '08:00',
    window_end: '10:00',
  };
  const [start, setStart] = useState(initial.window_start);
  const [end, setEnd] = useState(initial.window_end);
  const [days, setDays] = useState<DayOfWeek[]>(data.days_of_week ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: DayOfWeek): void => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  };

  const handleNext = (): void => {
    if (days.length === 0) {
      setError('Select at least one day');
      return;
    }
    if (end < start) {
      setError('End must be after start');
      return;
    }
    setError(null);
    onNext({
      frequency: 'daily',
      times_of_day: [{ window_start: start, window_end: end }],
      days_of_week: days,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        When should we remind you?
      </h2>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Window start</span>
        <input
          aria-label="Window start"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Window end</span>
        <input
          aria-label="Window end"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        />
      </label>

      <fieldset style={{ border: '1px solid #E5F4F2', borderRadius: 12, padding: 12 }}>
        <legend style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14, color: '#092C4C' }}>
          Days
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DAY_LABELS.map((d) => (
            <label
              key={d.value}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                aria-label={d.label}
                checked={days.includes(d.value)}
                onChange={() => toggleDay(d.value)}
              />
              <span style={{ fontSize: 14 }}>{d.label.slice(0, 3)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p style={{ color: '#B3261E', fontSize: 12, margin: 0 }}>{error}</p>
      )}

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
