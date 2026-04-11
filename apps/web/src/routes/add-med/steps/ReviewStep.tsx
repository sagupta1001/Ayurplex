import type { ReactElement } from 'react';
import type { MealRelationship } from '@ayurplex/shared';
import type { PartialAddMedData } from '../AddMedWizard';

export interface ReviewStepProps {
  data: PartialAddMedData;
  onSubmit: () => void;
  onBack: () => void;
}

const MEAL_LABEL: Record<MealRelationship, string> = {
  before: 'Before meal',
  with: 'With meal',
  after: 'After meal',
  any: 'Any time',
};

export function ReviewStep({ data, onSubmit, onBack }: ReviewStepProps): ReactElement {
  const windows = data.times_of_day ?? [];
  const days = data.days_of_week ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>Review</h2>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          rowGap: 8,
          columnGap: 16,
          fontFamily: 'Roboto, sans-serif',
          fontSize: 14,
          color: '#092C4C',
        }}
      >
        <dt style={{ color: '#4D9999' }}>Name</dt>
        <dd style={{ margin: 0 }}>{data.name ?? '—'}</dd>

        <dt style={{ color: '#4D9999' }}>Dosage</dt>
        <dd style={{ margin: 0 }}>
          {data.dosage_amount ?? '—'} {data.dosage_unit ?? ''} {data.form ?? ''}
        </dd>

        <dt style={{ color: '#4D9999' }}>Instructions</dt>
        <dd style={{ margin: 0 }}>{data.instructions ?? '—'}</dd>

        <dt style={{ color: '#4D9999' }}>Meal</dt>
        <dd style={{ margin: 0 }}>
          {data.meal_relationship ? MEAL_LABEL[data.meal_relationship] : '—'}
        </dd>

        <dt style={{ color: '#4D9999' }}>Windows</dt>
        <dd style={{ margin: 0 }}>
          {windows.length > 0
            ? windows.map((w) => `${w.window_start} \u2013 ${w.window_end}`).join(', ')
            : '—'}
        </dd>

        <dt style={{ color: '#4D9999' }}>Days</dt>
        <dd style={{ margin: 0 }}>{days.length > 0 ? days.join(', ') : '—'}</dd>

        <dt style={{ color: '#4D9999' }}>Room</dt>
        <dd style={{ margin: 0 }}>{data.preferred_room_id ?? '—'}</dd>

        <dt style={{ color: '#4D9999' }}>Dates</dt>
        <dd style={{ margin: 0 }}>
          {data.start_date ?? '—'}
          {data.end_date ? ` \u2192 ${data.end_date}` : ''}
        </dd>
      </dl>
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
          onClick={onSubmit}
          style={{
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 999,
            padding: '12px 24px',
            cursor: 'pointer',
          }}
        >
          Save medication
        </button>
      </div>
    </div>
  );
}
