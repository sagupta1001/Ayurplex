import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMedication } from '@/features/medications/api';
import { createSchedule } from '@/features/schedules/api';
import { MEDICATIONS_QUERY_KEY } from '@/features/medications/useMedications';
import { DOSES_TODAY_QUERY_KEY } from '@/features/doses/useDueToday';
import { useProfile } from '@/features/profiles/useProfile';
import { MedicationForm } from '@/features/medications/MedicationForm';
import type { MedicationFormData } from '@/features/medications/MedicationForm';

const today = new Date().toISOString().slice(0, 10);

const INITIAL: MedicationFormData = {
  name: '',
  dosage_amount: 0,
  dosage_unit: 'mg',
  form: 'tablet',
  instructions: null,
  meal_relationship: 'any',
  frequency: 'daily',
  times_of_day: [{ window_start: '08:00', window_end: '09:00' }],
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  preferred_room_id: null,
  start_date: today,
  end_date: null,
};

export function AddMedRoute(): ReactElement {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: MedicationFormData) => {
      const medication = await createMedication({
        name: data.name,
        dosage_amount: data.dosage_amount,
        dosage_unit: data.dosage_unit,
        form: data.form,
        instructions: data.instructions,
        meal_relationship: data.meal_relationship,
        start_date: data.start_date,
        end_date: data.end_date,
      });
      await createSchedule(
        medication,
        {
          frequency: data.frequency,
          times_of_day: data.times_of_day,
          days_of_week: data.days_of_week,
          preferred_room_id: data.preferred_room_id,
        },
        { timezone, startDate: data.start_date, days: 7 },
      );
      return medication;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
      await qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      navigate('/');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save medication');
    },
  });

  return (
    <div>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #E0E0E0',
          background: '#FFFFFF',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back"
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#092C4C', marginRight: 12 }}
        >
          ←
        </button>
        <h1 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 20, fontWeight: 600, color: '#092C4C', margin: 0 }}>
          Add Medication
        </h1>
      </header>

      <MedicationForm
        initial={INITIAL}
        onSubmit={(data) => saveMutation.mutate(data)}
        onCancel={() => navigate('/')}
        submitLabel="Add medication"
        saving={saveMutation.isPending}
        error={error}
      />
    </div>
  );
}

export default AddMedRoute;
