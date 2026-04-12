import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ExtractedMedication, MealRelationship, ScheduleFrequency, TimeWindow } from '@ayurplex/shared';
import { ConfidenceDot } from './ConfidenceDot';

interface MedicationCardProps {
  medication: ExtractedMedication;
  index: number;
  onConfirm: (data: ConfirmedMedData) => Promise<void>;
  onSkip: () => void;
  disabled: boolean;
}

export interface ConfirmedMedData {
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  frequency: ScheduleFrequency;
  meal_relationship: MealRelationship;
  times_of_day: TimeWindow[];
  duration_days: number | null;
}

export function MedicationCard({ medication, index, onConfirm, onSkip, disabled }: MedicationCardProps): ReactElement {
  const [name, setName] = useState(medication.name ?? '');
  const [dosageAmount, setDosageAmount] = useState(medication.dosage_amount ?? 0);
  const [dosageUnit, setDosageUnit] = useState(medication.dosage_unit ?? 'mg');
  const [frequency, setFrequency] = useState<ScheduleFrequency>(medication.frequency ?? 'daily');
  const [mealRelationship, setMealRelationship] = useState<MealRelationship>(medication.meal_relationship ?? 'any');
  const [timesOfDay, setTimesOfDay] = useState<TimeWindow[]>(
    medication.times_of_day ?? [{ window_start: '08:00', window_end: '09:00' }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!name.trim()) {
      setError('Medication name is required');
      return;
    }
    if (dosageAmount <= 0) {
      setError('Dosage amount must be greater than 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        name: name.trim(),
        dosage_amount: dosageAmount,
        dosage_unit: dosageUnit,
        frequency,
        meal_relationship: mealRelationship,
        times_of_day: timesOfDay,
        duration_days: medication.duration_days,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  function updateTimeWindow(idx: number, field: 'window_start' | 'window_end', value: string) {
    setTimesOfDay((prev) =>
      prev.map((tw, i) => (i === idx ? { ...tw, [field]: value } : tw)),
    );
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: '#4D9999',
    marginBottom: 4,
    fontFamily: 'Roboto, sans-serif',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Roboto, sans-serif',
    color: '#092C4C',
    background: '#FFFFFF',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'auto' as const,
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        border: '1px solid #E0E0E0',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <h3
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 16,
          fontWeight: 600,
          color: '#092C4C',
          margin: '0 0 12px',
        }}
      >
        Medication {index + 1}
      </h3>

      {/* Name */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Name <ConfidenceDot score={medication.confidence.name} />
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="Medication name"
        />
      </div>

      {/* Dosage */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>
            Amount <ConfidenceDot score={medication.confidence.dosage} />
          </label>
          <input
            type="number"
            value={dosageAmount}
            onChange={(e) => setDosageAmount(Number(e.target.value))}
            style={inputStyle}
            min={0}
            step="any"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Unit</label>
          <input
            type="text"
            value={dosageUnit}
            onChange={(e) => setDosageUnit(e.target.value)}
            style={inputStyle}
            placeholder="mg"
          />
        </div>
      </div>

      {/* Frequency */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Frequency <ConfidenceDot score={medication.confidence.frequency} />
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
          style={selectStyle}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="as_needed">As Needed</option>
        </select>
      </div>

      {/* Meal Relationship */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Meal Relationship <ConfidenceDot score={medication.confidence.meal} />
        </label>
        <select
          value={mealRelationship}
          onChange={(e) => setMealRelationship(e.target.value as MealRelationship)}
          style={selectStyle}
        >
          <option value="before">Before Meal</option>
          <option value="with">With Meal</option>
          <option value="after">After Meal</option>
          <option value="any">Any Time</option>
        </select>
      </div>

      {/* Times of Day */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Times <ConfidenceDot score={medication.confidence.times} />
        </label>
        {timesOfDay.map((tw, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
            <input
              type="time"
              value={tw.window_start}
              onChange={(e) => updateTimeWindow(i, 'window_start', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ color: '#4D9999', fontSize: 13 }}>to</span>
            <input
              type="time"
              value={tw.window_end}
              onChange={(e) => updateTimeWindow(i, 'window_end', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p role="alert" style={{ color: '#C62828', fontSize: 13, margin: '0 0 8px' }}>
          {error}
        </p>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleConfirm}
          disabled={saving}
          style={{
            flex: 1,
            padding: '10px 0',
            background: saving ? '#A5D6A7' : '#2E7D32',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
            fontFamily: 'Roboto, sans-serif',
          }}
        >
          {saving ? 'Saving...' : 'Confirm'}
        </button>
        <button
          onClick={onSkip}
          disabled={saving}
          style={{
            flex: 1,
            padding: '10px 0',
            background: '#F5F5F5',
            color: '#757575',
            border: '1px solid #E0E0E0',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: saving ? 'default' : 'pointer',
            fontFamily: 'Roboto, sans-serif',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
