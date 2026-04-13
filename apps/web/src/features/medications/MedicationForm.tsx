import { useState } from 'react';
import type { ReactElement } from 'react';
import type {
  MealRelationship,
  ScheduleFrequency,
  TimeWindow,
  DayOfWeek,
  MedicationForm as MedicationFormType,
} from '@ayurplex/shared';

// ─── Public types ────────────────────────────────────────────────────────────

export interface MedicationFormData {
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  form: MedicationFormType;
  instructions: string | null;
  meal_relationship: MealRelationship;
  frequency: ScheduleFrequency;
  times_of_day: TimeWindow[];
  days_of_week: DayOfWeek[];
  preferred_room_id: string | null;
  start_date: string;
  end_date: string | null;
}

export interface MedicationFormProps {
  initial: MedicationFormData;
  onSubmit: (data: MedicationFormData) => void;
  onCancel: () => void;
  /** "Save medication" or "Save changes" */
  submitLabel: string;
  saving?: boolean;
  error?: string | null;
  /** Show deactivate / delete buttons at the bottom */
  showDangerZone?: boolean;
  onDeactivate?: () => void;
  onDelete?: () => void;
}

// ─── Shared style primitives ─────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Roboto, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: '#4D9999',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  fontFamily: 'Roboto, sans-serif',
  fontSize: 14,
  color: '#092C4C',
  border: '1px solid #E0E0E0',
  borderRadius: 8,
  padding: '8px 10px',
  width: '100%',
  boxSizing: 'border-box',
  background: '#FFFFFF',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234D9999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 30,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 20,
};

const errorTextStyle: React.CSSProperties = {
  fontFamily: 'Roboto, sans-serif',
  fontSize: 12,
  color: '#D32F2F',
  marginTop: 4,
};

const ALL_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];
const DAY_LABELS: Record<DayOfWeek, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function MedicationForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  saving = false,
  error = null,
  showDangerZone = false,
  onDeactivate,
  onDelete,
}: MedicationFormProps): ReactElement {
  // ── Field state ──────────────────────────────────────────────────────────
  const [name, setName] = useState(initial.name);
  const [dosageAmount, setDosageAmount] = useState(initial.dosage_amount);
  const [dosageUnit, setDosageUnit] = useState(initial.dosage_unit);
  const [form, setForm] = useState<MedicationFormType>(initial.form);
  const [instructions, setInstructions] = useState(initial.instructions ?? '');
  const [mealRelationship, setMealRelationship] = useState<MealRelationship>(
    initial.meal_relationship,
  );
  const [frequency, setFrequency] = useState<ScheduleFrequency>(initial.frequency);
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(initial.days_of_week);
  const [timesOfDay, setTimesOfDay] = useState<TimeWindow[]>(
    initial.times_of_day.length > 0 ? initial.times_of_day : [{ window_start: '', window_end: '' }],
  );
  const [startDate, setStartDate] = useState(initial.start_date);
  const [noEndDate, setNoEndDate] = useState(initial.end_date === null);
  const [endDate, setEndDate] = useState(initial.end_date ?? '');

  // ── Validation errors ────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleFrequencyChange(freq: ScheduleFrequency) {
    setFrequency(freq);
    if (freq === 'daily') {
      setDaysOfWeek(ALL_DAYS);
    }
  }

  function toggleDay(day: DayOfWeek) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function updateTimeWindow(index: number, field: keyof TimeWindow, value: string) {
    setTimesOfDay((prev) => prev.map((tw, i) => (i === index ? { ...tw, [field]: value } : tw)));
  }

  function addTimeWindow() {
    setTimesOfDay((prev) => [...prev, { window_start: '', window_end: '' }]);
  }

  function removeTimeWindow(index: number) {
    if (timesOfDay.length <= 1) return;
    setTimesOfDay((prev) => prev.filter((_, i) => i !== index));
  }

  function handleNoEndDateToggle(checked: boolean) {
    setNoEndDate(checked);
    if (checked) setEndDate('');
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Medication name is required.';
    if (!dosageAmount || dosageAmount <= 0) newErrors.dosageAmount = 'Dosage amount must be greater than 0.';
    if (timesOfDay.length === 0) newErrors.timesOfDay = 'At least one time window is required.';
    if (daysOfWeek.length === 0) newErrors.daysOfWeek = 'At least one day of week is required.';
    if (!startDate) newErrors.startDate = 'Start date is required.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: name.trim(),
      dosage_amount: dosageAmount,
      dosage_unit: dosageUnit.trim(),
      form,
      instructions: instructions.trim() || null,
      meal_relationship: mealRelationship,
      frequency,
      times_of_day: timesOfDay,
      days_of_week: daysOfWeek,
      preferred_room_id: initial.preferred_room_id,
      start_date: startDate,
      end_date: noEndDate ? null : endDate || null,
    });
  }

  function handleDelete() {
    if (window.confirm('Are you sure you want to delete this medication? This cannot be undone.')) {
      onDelete?.();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        fontFamily: 'Roboto, sans-serif',
        maxWidth: 560,
        margin: '0 auto',
        padding: '24px 20px',
        background: '#F7F9FB',
        minHeight: '100vh',
      }}
    >
      {/* ── Name ── */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="med-name">
          Medication Name
        </label>
        <input
          id="med-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Metformin"
          style={inputStyle}
        />
        {errors.name && <p style={errorTextStyle}>{errors.name}</p>}
      </div>

      {/* ── Dosage ── */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Dosage</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: '0 0 110px' }}>
            <input
              type="number"
              min={0}
              step="any"
              value={dosageAmount}
              onChange={(e) => setDosageAmount(parseFloat(e.target.value) || 0)}
              placeholder="Amount"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={dosageUnit}
              onChange={(e) => setDosageUnit(e.target.value)}
              placeholder="Unit (mg, ml…)"
              style={inputStyle}
            />
          </div>
        </div>
        {errors.dosageAmount && <p style={errorTextStyle}>{errors.dosageAmount}</p>}
      </div>

      {/* ── Form ── */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="med-form">
          Form
        </label>
        <div style={{ position: 'relative' }}>
          <select
            id="med-form"
            value={form}
            onChange={(e) => setForm(e.target.value as MedicationFormType)}
            style={selectStyle}
          >
            <option value="tablet">Tablet</option>
            <option value="capsule">Capsule</option>
            <option value="liquid">Liquid</option>
          </select>
        </div>
      </div>

      {/* ── Instructions ── */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="med-instructions">
          Instructions <span style={{ color: '#AAA', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="med-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Take with a full glass of water"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* ── Meal Relationship ── */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="med-meal">
          Meal Relationship
        </label>
        <div style={{ position: 'relative' }}>
          <select
            id="med-meal"
            value={mealRelationship}
            onChange={(e) => setMealRelationship(e.target.value as MealRelationship)}
            style={selectStyle}
          >
            <option value="before">Before meal</option>
            <option value="with">With meal</option>
            <option value="after">After meal</option>
            <option value="any">Any time</option>
          </select>
        </div>
      </div>

      {/* ── Frequency ── */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="med-frequency">
          Frequency
        </label>
        <div style={{ position: 'relative' }}>
          <select
            id="med-frequency"
            value={frequency}
            onChange={(e) => handleFrequencyChange(e.target.value as ScheduleFrequency)}
            style={selectStyle}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="as_needed">As needed</option>
          </select>
        </div>
      </div>

      {/* ── Days of Week ── */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Days of Week</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_DAYS.map((day) => {
            const active = daysOfWeek.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1.5px solid ${active ? '#007972' : '#E0E0E0'}`,
                  background: active ? '#007972' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#092C4C',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {DAY_LABELS[day]}
              </button>
            );
          })}
        </div>
        {errors.daysOfWeek && <p style={errorTextStyle}>{errors.daysOfWeek}</p>}
      </div>

      {/* ── Time Windows ── */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Time Windows</label>
        {timesOfDay.map((tw, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              <input
                type="time"
                value={tw.window_start}
                onChange={(e) => updateTimeWindow(index, 'window_start', e.target.value)}
                style={inputStyle}
                aria-label={`Time window ${index + 1} start`}
              />
            </div>
            <span style={{ color: '#4D9999', fontSize: 13, whiteSpace: 'nowrap' }}>to</span>
            <div style={{ flex: 1 }}>
              <input
                type="time"
                value={tw.window_end}
                onChange={(e) => updateTimeWindow(index, 'window_end', e.target.value)}
                style={inputStyle}
                aria-label={`Time window ${index + 1} end`}
              />
            </div>
            <button
              type="button"
              onClick={() => removeTimeWindow(index)}
              disabled={timesOfDay.length <= 1}
              aria-label="Remove time window"
              style={{
                background: 'none',
                border: 'none',
                cursor: timesOfDay.length <= 1 ? 'not-allowed' : 'pointer',
                color: timesOfDay.length <= 1 ? '#CCCCCC' : '#D32F2F',
                fontSize: 18,
                lineHeight: 1,
                padding: '4px 6px',
                borderRadius: 4,
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addTimeWindow}
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: 13,
            color: '#007972',
            background: 'none',
            border: '1.5px dashed #007972',
            borderRadius: 8,
            padding: '6px 14px',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          + Add time window
        </button>
        {errors.timesOfDay && <p style={errorTextStyle}>{errors.timesOfDay}</p>}
      </div>

      {/* ── Start Date ── */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="med-start-date">
          Start Date
        </label>
        <input
          id="med-start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={inputStyle}
        />
        {errors.startDate && <p style={errorTextStyle}>{errors.startDate}</p>}
      </div>

      {/* ── End Date ── */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="med-end-date">
          End Date
        </label>
        <input
          id="med-end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={noEndDate}
          style={{ ...inputStyle, opacity: noEndDate ? 0.45 : 1 }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            fontFamily: 'Roboto, sans-serif',
            fontSize: 13,
            color: '#4D9999',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={noEndDate}
            onChange={(e) => handleNoEndDateToggle(e.target.checked)}
            style={{ accentColor: '#007972' }}
          />
          No end date
        </label>
      </div>

      {/* ── Room ── */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Room</label>
        <div
          style={{
            ...inputStyle,
            color: '#4D9999',
            background: '#F0F4F8',
            cursor: 'default',
          }}
        >
          {initial.preferred_room_id ?? 'None'}
        </div>
      </div>

      {/* ── Global error banner ── */}
      {error && (
        <div
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: 14,
            color: '#D32F2F',
            background: '#FFF0F0',
            border: '1px solid #FFCDD2',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            flex: 1,
            fontFamily: 'Roboto, sans-serif',
            fontSize: 15,
            fontWeight: 500,
            padding: '12px 0',
            borderRadius: 999,
            border: '1.5px solid #E0E0E0',
            background: '#FFFFFF',
            color: '#092C4C',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 2,
            fontFamily: 'Roboto, sans-serif',
            fontSize: 15,
            fontWeight: 600,
            padding: '12px 0',
            borderRadius: 999,
            border: 'none',
            background: saving ? '#7BB8B5' : '#007972',
            color: '#FFFFFF',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>

      {/* ── Danger Zone ── */}
      {showDangerZone && (
        <div
          style={{
            marginTop: 36,
            padding: '16px 18px',
            borderRadius: 12,
            border: '1px solid #FFE0E0',
            background: '#FFFAFA',
          }}
        >
          <p
            style={{
              fontFamily: 'Lexend, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: '#B71C1C',
              margin: '0 0 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Danger Zone
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {onDeactivate && (
              <button
                type="button"
                onClick={onDeactivate}
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: '1.5px solid #E65100',
                  background: 'transparent',
                  color: '#E65100',
                  cursor: 'pointer',
                }}
              >
                Deactivate
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: '1.5px solid #D32F2F',
                  background: 'transparent',
                  color: '#D32F2F',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
