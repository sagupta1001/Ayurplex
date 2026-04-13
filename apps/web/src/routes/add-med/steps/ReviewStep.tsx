import type { ReactElement } from 'react';
import type { PartialAddMedData } from '../AddMedWizard';
import { MedicationForm } from '@/features/medications/MedicationForm';
import type { MedicationFormData } from '@/features/medications/MedicationForm';

export interface ReviewStepProps {
  data: PartialAddMedData;
  onSubmit: (updatedData: MedicationFormData) => void;
  onBack: () => void;
}

export function ReviewStep({ data, onSubmit, onBack }: ReviewStepProps): ReactElement {
  const initial: MedicationFormData = {
    name: data.name ?? '',
    dosage_amount: data.dosage_amount ?? 0,
    dosage_unit: data.dosage_unit ?? 'mg',
    form: data.form ?? 'tablet',
    instructions: data.instructions ?? null,
    meal_relationship: data.meal_relationship ?? 'any',
    frequency: data.frequency ?? 'daily',
    times_of_day: data.times_of_day ?? [{ window_start: '08:00', window_end: '09:00' }],
    days_of_week: data.days_of_week ?? [1, 2, 3, 4, 5, 6, 7],
    preferred_room_id: data.preferred_room_id ?? null,
    start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: data.end_date ?? null,
  };

  return (
    <MedicationForm
      initial={initial}
      onSubmit={onSubmit}
      onCancel={onBack}
      submitLabel="Save medication"
    />
  );
}
