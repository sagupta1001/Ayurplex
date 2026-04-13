import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { Medication } from '@ayurplex/shared';

export interface MedicationListItemProps {
  medication: Medication;
}

export function MedicationListItem({ medication }: MedicationListItemProps): ReactElement {
  return (
    <li
      data-testid={`med-${medication.id}`}
      style={{
        listStyle: 'none',
        marginBottom: 8,
      }}
    >
      <Link
        to={`/edit-med/${medication.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 12,
          background: '#FFFFFF',
          boxShadow: '0 1px 4px rgba(9, 44, 76, 0.08)',
          textDecoration: 'none',
          color: 'inherit',
          cursor: 'pointer',
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
            {medication.name}
          </div>
          <div
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: 14,
              color: '#4D9999',
            }}
          >
            {medication.dosage_amount} {medication.dosage_unit} · {medication.form}
          </div>
        </div>
        <span style={{ color: '#4D9999', fontSize: 20, fontWeight: 300 }}>›</span>
      </Link>
    </li>
  );
}
