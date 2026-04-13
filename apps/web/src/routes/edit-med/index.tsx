import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMedicationById, updateMedication, deactivateMedication, deleteMedication } from '@/features/medications/api';
import { getScheduleByMedicationId, updateSchedule } from '@/features/schedules/api';
import { useProfile } from '@/features/profiles/useProfile';
import { MEDICATIONS_QUERY_KEY } from '@/features/medications/useMedications';
import { DOSES_TODAY_QUERY_KEY } from '@/features/doses/useDueToday';
import { MedicationForm } from '@/features/medications/MedicationForm';
import type { MedicationFormData } from '@/features/medications/MedicationForm';

export function EditMedRoute(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';
  const [error, setError] = useState<string | null>(null);

  const { data: medication, isLoading: loadingMed } = useQuery({
    queryKey: ['medication', id],
    queryFn: () => getMedicationById(id!),
    enabled: !!id,
  });

  const { data: schedule, isLoading: loadingSchedule } = useQuery({
    queryKey: ['medication-schedule', id],
    queryFn: () => getScheduleByMedicationId(id!),
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: MedicationFormData) => {
      if (!medication || !id) throw new Error('No medication loaded');

      const updatedMed = await updateMedication(id, {
        name: data.name,
        dosage_amount: data.dosage_amount,
        dosage_unit: data.dosage_unit,
        form: data.form,
        instructions: data.instructions,
        meal_relationship: data.meal_relationship,
        start_date: data.start_date,
        end_date: data.end_date,
      });

      if (schedule) {
        await updateSchedule(
          schedule.id,
          updatedMed,
          {
            frequency: data.frequency,
            times_of_day: data.times_of_day,
            days_of_week: data.days_of_week,
            preferred_room_id: data.preferred_room_id,
          },
          { timezone },
        );
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
      await qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      navigate('/');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    },
  });

  const deactivateMut = useMutation({
    mutationFn: () => deactivateMedication(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
      await qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      navigate('/');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteMedication(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
      await qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      navigate('/');
    },
  });

  if (loadingMed || loadingSchedule) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Roboto, sans-serif', color: '#4D9999' }}>
        Loading medication…
      </div>
    );
  }

  if (!medication) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Roboto, sans-serif', color: '#D32F2F' }}>
        Medication not found.
      </div>
    );
  }

  const initial: MedicationFormData = {
    name: medication.name,
    dosage_amount: medication.dosage_amount,
    dosage_unit: medication.dosage_unit,
    form: medication.form,
    instructions: medication.instructions,
    meal_relationship: medication.meal_relationship,
    frequency: schedule?.frequency ?? 'daily',
    times_of_day: schedule?.times_of_day ?? [{ window_start: '08:00', window_end: '09:00' }],
    days_of_week: schedule?.days_of_week ?? [1, 2, 3, 4, 5, 6, 7],
    preferred_room_id: schedule?.preferred_room_id ?? null,
    start_date: medication.start_date,
    end_date: medication.end_date,
  };

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
          Edit Medication
        </h1>
      </header>

      <MedicationForm
        initial={initial}
        onSubmit={(data) => saveMutation.mutate(data)}
        onCancel={() => navigate('/')}
        submitLabel="Save changes"
        saving={saveMutation.isPending}
        error={error}
        showDangerZone
        onDeactivate={() => deactivateMut.mutate()}
        onDelete={() => deleteMut.mutate()}
      />
    </div>
  );
}

export default EditMedRoute;
