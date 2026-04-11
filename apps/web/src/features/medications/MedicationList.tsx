import type { ReactElement } from 'react';
import type { Medication } from '@ayurplex/shared';
import { MedicationListItem } from './MedicationListItem';

export interface MedicationListProps {
  medications: Medication[];
}

export function MedicationList({ medications }: MedicationListProps): ReactElement {
  if (medications.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: 14,
          color: '#4D9999',
          textAlign: 'center',
          padding: 24,
        }}
      >
        No medications yet. Tap &quot;+&quot; to add your first one.
      </p>
    );
  }
  return (
    <ul style={{ padding: 0, margin: 0 }}>
      {medications.map((m) => (
        <MedicationListItem key={m.id} medication={m} />
      ))}
    </ul>
  );
}
