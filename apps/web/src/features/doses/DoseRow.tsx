import type { ReactElement } from 'react';
import type { ScheduledDose } from '@ayurplex/shared';
import { formatLocalTime } from '../../lib/date';

export interface DoseRowProps {
  dose: ScheduledDose;
  medicationName: string;
  timezone: string;
  onMarkTaken: (doseId: string) => void;
}

export function DoseRow({
  dose,
  medicationName,
  timezone,
  onMarkTaken,
}: DoseRowProps): ReactElement {
  const time = formatLocalTime(new Date(dose.scheduled_for), timezone);
  const isTaken = dose.status === 'taken';

  return (
    <div
      data-testid={`dose-row-${dose.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 16,
        background: '#FFFFFF',
        boxShadow: '0 1px 4px rgba(9, 44, 76, 0.08)',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 16,
            fontWeight: 500,
            color: '#092C4C',
          }}
        >
          {medicationName}
        </div>
        <div
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: 14,
            color: '#4D9999',
          }}
        >
          {time}
        </div>
      </div>
      {isTaken ? (
        <span
          aria-label="Taken"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 16,
            background: '#19AFA2',
            color: '#FFFFFF',
            fontSize: 18,
          }}
        >
          ✓
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onMarkTaken(dose.id)}
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: '#FFFFFF',
            background: '#007972',
            border: 'none',
            borderRadius: 999,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Mark as taken
        </button>
      )}
    </div>
  );
}
