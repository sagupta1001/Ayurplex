import { useState } from 'react';
import type { ReactElement } from 'react';
import type { MealRelationship } from '@ayurplex/shared';
import { AppleMealIcon } from '@/features/doses/AppleMealIcon';
import type { StepProps } from './types';

interface Option {
  value: MealRelationship;
  label: string;
}

const OPTIONS: Option[] = [
  { value: 'before', label: 'Before meal' },
  { value: 'with', label: 'With meal' },
  { value: 'after', label: 'After meal' },
  { value: 'any', label: 'Any time' },
];

export function MealRelationshipStep({ data, onNext, onBack }: StepProps): ReactElement {
  const [selected, setSelected] = useState<MealRelationship>(data.meal_relationship ?? 'any');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        When do you take it?
      </h2>

      <div
        role="radiogroup"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
      >
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 16,
              borderRadius: 16,
              border: selected === opt.value ? '2px solid #19AFA2' : '2px solid #E5F4F2',
              background: '#FFFFFF',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <input
              type="radio"
              name="meal_relationship"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              aria-label={opt.label}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <AppleMealIcon relationship={opt.value} size={72} title={opt.value} />
            <span
              style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 14,
                color: '#092C4C',
                marginTop: 8,
              }}
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>

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
          onClick={() => onNext({ meal_relationship: selected })}
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
