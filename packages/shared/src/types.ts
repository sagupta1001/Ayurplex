// Domain type stubs for Ayurplex. Expanded in later plans.
//
// We use branded primitive types (nominal typing) so IDs cannot be accidentally
// mixed (e.g. passing a MedicationId where a UserId is expected).

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;

export const makeUserId = (value: string): UserId => value as UserId;

// ---------------------------------------------------------------------------
// Plan 3 — Medication domain types
// ---------------------------------------------------------------------------

/** Relationship of a medication to a meal. */
export type MealRelationship = 'before' | 'with' | 'after' | 'any';

/** Pharmaceutical form of a medication. */
export type MedicationForm = 'tablet' | 'capsule' | 'liquid';

/** Cadence of a medication schedule. */
export type ScheduleFrequency = 'daily' | 'weekly' | 'as_needed';

/** ISO day-of-week, Monday = 1 ... Sunday = 7 (matches Postgres int[] convention). */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A [start, end] time window expressed in 24h HH:MM local time. */
export interface TimeWindow {
  window_start: string; // e.g. "08:00"
  window_end: string; // e.g. "11:00"
}

/** Status of a materialized scheduled dose. */
export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

/** Reason the rule engine adjusted a dose (Plan 3 always writes 'none'). */
export type DoseAdjustmentReason = 'meeting_conflict' | 'travel' | 'quiet_hours' | 'none';

/** Channel through which a dose was logged as taken. */
export type TakenVia = 'manual' | 'voice' | 'auto';

/** A medication row, surfaced to the UI. */
export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  form: MedicationForm;
  instructions: string | null;
  meal_relationship: MealRelationship;
  start_date: string; // ISO date
  end_date: string | null;
  prescription_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** A medication schedule row, surfaced to the UI. */
export interface MedicationSchedule {
  id: string;
  medication_id: string;
  user_id: string;
  frequency: ScheduleFrequency;
  times_of_day: TimeWindow[];
  days_of_week: DayOfWeek[];
  preferred_room_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A materialized dose row, surfaced to the UI. */
export interface ScheduledDose {
  id: string;
  user_id: string;
  medication_id: string;
  schedule_id: string;
  scheduled_for: string; // ISO UTC timestamptz
  adjusted_for: string | null;
  adjustment_reason: DoseAdjustmentReason | null;
  status: DoseStatus;
  taken_at: string | null;
  taken_via: TakenVia | null;
  created_at: string;
  updated_at: string;
}

/** Input accepted by `createMedication`. */
export interface MedicationInput {
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  form: MedicationForm;
  instructions: string | null;
  meal_relationship: MealRelationship;
  start_date: string;
  end_date: string | null;
}

/** Input accepted by `createSchedule`. */
export interface MedicationScheduleInput {
  frequency: ScheduleFrequency;
  times_of_day: TimeWindow[];
  days_of_week: DayOfWeek[];
  preferred_room_id: string | null;
}

/** Shape of a row inserted by the naive materializer. */
export interface ScheduledDoseInsert {
  user_id: string;
  medication_id: string;
  schedule_id: string;
  scheduled_for: string;
  adjusted_for: string;
  adjustment_reason: DoseAdjustmentReason;
  status: DoseStatus;
}

// ---------------------------------------------------------------------------
// Plan 4 — Web Push Notifications
// ---------------------------------------------------------------------------

/** A push subscription row stored in the database. */
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

/** Insert shape for push_subscriptions. */
export interface PushSubscriptionInsert {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ---------------------------------------------------------------------------
// Plan 5 — Prescription Upload
// ---------------------------------------------------------------------------

/** Status of a prescription upload. */
export type PrescriptionStatus = 'pending_review' | 'confirmed' | 'rejected';

/** Confidence scores for a single extracted medication field. */
export interface ConfidenceScores {
  name: number;
  dosage: number;
  frequency: number;
  times: number;
  meal: number;
}

/** A single medication extracted by Claude Vision. */
export interface ExtractedMedication {
  name: string | null;
  dosage_amount: number | null;
  dosage_unit: string | null;
  frequency: ScheduleFrequency | null;
  times_of_day: TimeWindow[] | null;
  meal_relationship: MealRelationship | null;
  duration_days: number | null;
  confidence: ConfidenceScores;
}

/** Structured output from Claude Vision parsing. */
export interface VisionParsed {
  medications: ExtractedMedication[];
  doctor_name: string | null;
  date_prescribed: string | null;
  notes: string | null;
}

/** A prescription row from the database. */
export interface Prescription {
  id: string;
  user_id: string;
  storage_path: string;
  uploaded_at: string;
  vision_raw_response: unknown | null;
  vision_parsed: VisionParsed | null;
  status: PrescriptionStatus;
  created_at: string;
  updated_at: string;
}
