import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Medication } from '@ayurplex/shared';
import { MedicationList } from '../MedicationList';

const metformin: Medication = {
  id: 'med-1',
  user_id: 'user-1',
  name: 'Metformin',
  dosage_amount: 500,
  dosage_unit: 'mg',
  form: 'tablet',
  instructions: 'with food',
  meal_relationship: 'with',
  start_date: '2026-04-11',
  end_date: null,
  prescription_id: null,
  active: true,
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};

describe('MedicationList', () => {
  it('renders an empty state when list is empty', () => {
    render(<MedicationList medications={[]} />);
    expect(screen.getByText(/no medications/i)).toBeInTheDocument();
  });

  it('renders one MedicationListItem per row', () => {
    render(<MedicationList medications={[metformin]} />);
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText(/500 mg/i)).toBeInTheDocument();
  });
});
