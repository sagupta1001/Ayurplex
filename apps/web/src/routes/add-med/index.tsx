import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddMedWizard } from './AddMedWizard';
import type { AddMedFormData } from './schema';
import { createMedication } from '@/features/medications/api';
import { createSchedule } from '@/features/schedules/api';
import { MEDICATIONS_QUERY_KEY } from '@/features/medications/useMedications';
import { DOSES_TODAY_QUERY_KEY } from '@/features/doses/useDueToday';
import { useProfile } from '@/features/profiles/useProfile';

export function AddMedRoute(): ReactElement {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';

  const saveMutation = useMutation({
    mutationFn: async (data: AddMedFormData) => {
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
  });

  return (
    <div
      role="dialog"
      aria-label="Add medication"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 44, 76, 0.32)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: '#F5FAF9',
          width: '100%',
          maxWidth: 480,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '95vh',
          overflowY: 'auto',
        }}
      >
        <AddMedWizard
          onSubmit={(data) => saveMutation.mutate(data)}
          onClose={() => navigate('/')}
        />
        {saveMutation.isError && (
          <p role="alert" style={{ color: '#B3261E', padding: 16 }}>
            Could not save medication. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}

export default AddMedRoute;
