import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ExtractedMedication } from '@ayurplex/shared';
import { getPrescription, updatePrescriptionStatus } from '@/features/prescriptions/api';
import { createMedication } from '@/features/medications/api';
import { createSchedule } from '@/features/schedules/api';
import { MEDICATIONS_QUERY_KEY } from '@/features/medications/useMedications';
import { DOSES_TODAY_QUERY_KEY } from '@/features/doses/useDueToday';
import { useProfile } from '@/features/profiles/useProfile';
import { MedicationCard, type ConfirmedMedData } from './MedicationCard';
import { ConfidenceDot } from './ConfidenceDot';

type CardStatus = 'pending' | 'confirmed' | 'skipped';

export function ReviewScreen(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';

  const [medications, setMedications] = useState<ExtractedMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cardStatuses, setCardStatuses] = useState<CardStatus[]>([]);
  const [confirmedCount, setConfirmedCount] = useState(0);

  // Fetch prescription data
  useEffect(() => {
    if (!id) return;
    getPrescription(id)
      .then((prescription) => {
        const meds = prescription.vision_parsed?.medications ?? [];
        setMedications(meds);
        setCardStatuses(meds.map(() => 'pending' as CardStatus));
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load prescription');
        setLoading(false);
      });
  }, [id]);

  const handleConfirm = useCallback(
    async (index: number, data: ConfirmedMedData) => {
      // Create medication
      const todayRaw = new Date().toISOString().split('T')[0];
      const today: string = todayRaw ?? new Date().toISOString().slice(0, 10);
      const endDateRaw = data.duration_days
        ? new Date(Date.now() + data.duration_days * 86400000).toISOString().split('T')[0]
        : null;
      const endDate: string | null = endDateRaw ?? null;

      const medication = await createMedication({
        name: data.name,
        dosage_amount: data.dosage_amount,
        dosage_unit: data.dosage_unit,
        form: 'tablet', // default for prescription uploads
        instructions: null,
        meal_relationship: data.meal_relationship,
        start_date: today,
        end_date: endDate,
      });

      // Create schedule + materialize doses
      await createSchedule(
        medication,
        {
          frequency: data.frequency,
          times_of_day: data.times_of_day,
          days_of_week: [1, 2, 3, 4, 5, 6, 7], // default to every day
          preferred_room_id: null,
        },
        { timezone, startDate: today, days: 7 },
      );

      // Mark card as confirmed
      setCardStatuses((prev) => prev.map((s, i) => (i === index ? 'confirmed' : s)));
      setConfirmedCount((c) => c + 1);
    },
    [timezone],
  );

  const handleSkip = useCallback((index: number) => {
    setCardStatuses((prev) => prev.map((s, i) => (i === index ? 'skipped' : s)));
  }, []);

  const handleRejectAll = useCallback(async () => {
    if (!id) return;
    await updatePrescriptionStatus(id, 'rejected');
    navigate('/add-med');
  }, [id, navigate]);

  // Check if all cards are handled
  const allHandled = cardStatuses.length > 0 && cardStatuses.every((s) => s !== 'pending');

  // Finalize when all cards are handled
  useEffect(() => {
    if (!allHandled || !id) return;
    // Update prescription status
    const finalStatus = confirmedCount > 0 ? 'confirmed' : 'rejected';
    updatePrescriptionStatus(id, finalStatus).catch(console.error);
    // Invalidate queries
    qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY }).catch(console.error);
    qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY }).catch(console.error);
  }, [allHandled, id, confirmedCount, qc]);

  // Loading state
  if (loading) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'Roboto, sans-serif', textAlign: 'center' }}>
        <p style={{ color: '#4D9999' }}>Loading prescription data...</p>
      </main>
    );
  }

  // Fetch error
  if (fetchError) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'Roboto, sans-serif' }}>
        <p style={{ color: '#C62828' }}>{fetchError}</p>
        <button onClick={() => navigate('/')} style={{ color: '#007972', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
          Back to Home
        </button>
      </main>
    );
  }

  // Done state
  if (allHandled) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'Roboto, sans-serif', textAlign: 'center', minHeight: '100vh', background: '#F5FAF9' }}>
        <div style={{ fontSize: 64, marginBottom: 16, marginTop: 48 }}>✅</div>
        <h1 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 24, fontWeight: 600, color: '#092C4C', margin: '0 0 8px' }}>
          {confirmedCount > 0
            ? `${confirmedCount} medication${confirmedCount > 1 ? 's' : ''} added!`
            : 'No medications added'}
        </h1>
        <p style={{ color: '#4D9999', margin: '0 0 32px', fontSize: 14 }}>
          {confirmedCount > 0
            ? 'Reminders will start based on your schedule.'
            : 'You can add medications manually.'}
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '14px 32px',
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Lexend, sans-serif',
            cursor: 'pointer',
          }}
        >
          Back to Home
        </button>
      </main>
    );
  }

  // No medications found
  if (medications.length === 0) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'Roboto, sans-serif', minHeight: '100vh', background: '#F5FAF9' }}>
        <h1 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 24, fontWeight: 600, color: '#092C4C', margin: '0 0 8px' }}>
          No medications found
        </h1>
        <p style={{ color: '#4D9999', margin: '0 0 24px', fontSize: 14 }}>
          We couldn't extract any medications from this prescription. Please try again with a clearer image, or enter medications manually.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/upload-prescription')}
            style={{ flex: 1, padding: '12px 0', background: '#007972', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Roboto, sans-serif' }}
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/add-med')}
            style={{ flex: 1, padding: '12px 0', background: '#F5F5F5', color: '#092C4C', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Roboto, sans-serif' }}
          >
            Enter Manually
          </button>
        </div>
      </main>
    );
  }

  // Review screen
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'Roboto, sans-serif', minHeight: '100vh', background: '#F5FAF9' }}>
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', color: '#007972', fontSize: 16, cursor: 'pointer', padding: 0, marginBottom: 16 }}
      >
        ← Back
      </button>

      <h1 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 24, fontWeight: 600, color: '#092C4C', margin: '0 0 8px' }}>
        We found {medications.length} medication{medications.length > 1 ? 's' : ''}
      </h1>
      <p style={{ color: '#4D9999', margin: '0 0 16px', fontSize: 14 }}>
        Review and confirm each medication below. Edit any fields that need correction.
      </p>

      {/* Confidence legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 12, color: '#757575' }}>
        <span><ConfidenceDot score={0.9} /> High</span>
        <span><ConfidenceDot score={0.6} /> Medium</span>
        <span><ConfidenceDot score={0.3} /> Low</span>
      </div>

      {/* Medication cards */}
      {medications.map((med, i) => (
        <MedicationCard
          key={i}
          medication={med}
          index={i}
          onConfirm={(data) => handleConfirm(i, data)}
          onSkip={() => handleSkip(i)}
          disabled={cardStatuses[i] !== 'pending'}
        />
      ))}

      {/* Reject all */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 32 }}>
        <button
          onClick={handleRejectAll}
          style={{ background: 'none', border: 'none', color: '#C62828', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Roboto, sans-serif' }}
        >
          Reject all &amp; enter manually
        </button>
      </div>
    </main>
  );
}
