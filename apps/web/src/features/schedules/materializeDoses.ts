import type {
  DayOfWeek,
  DoseAdjustmentReason,
  DoseStatus,
  MedicationScheduleInput,
  ScheduledDoseInsert,
  TimeWindow,
} from '@ayurplex/shared';
import { zonedTimeToUtc, addDays } from '../../lib/date';

export interface MaterializeDosesContext {
  userId: string;
  medicationId: string;
  scheduleId: string;
  timezone: string;
  startDate: string;
  days: number;
}

const STATUS_PENDING: DoseStatus = 'pending';
const REASON_NONE: DoseAdjustmentReason = 'none';

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const parts = ymd.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return { y, m, d };
}

function jsDayToIso(day: number): DayOfWeek {
  return (day === 0 ? 7 : day) as DayOfWeek;
}

function midpoint(window: TimeWindow): { hour: number; minute: number } {
  const startParts = window.window_start.split(':').map(Number);
  const endParts = window.window_end.split(':').map(Number);
  const sh = startParts[0] ?? 0;
  const sm = startParts[1] ?? 0;
  const eh = endParts[0] ?? 0;
  const em = endParts[1] ?? 0;
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) {
    throw new Error(
      `TimeWindow end (${window.window_end}) must be >= start (${window.window_start})`,
    );
  }
  const midMinutes = Math.floor((startMinutes + endMinutes) / 2);
  return { hour: Math.floor(midMinutes / 60), minute: midMinutes % 60 };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function materializeDoses(
  schedule: MedicationScheduleInput,
  ctx: MaterializeDosesContext,
): ScheduledDoseInsert[] {
  if (schedule.times_of_day.length === 0) {
    throw new Error('materializeDoses requires at least one time window');
  }

  const doses: ScheduledDoseInsert[] = [];
  const { y, m, d } = parseYmd(ctx.startDate);

  for (let dayOffset = 0; dayOffset < ctx.days; dayOffset++) {
    const dayDate = addDays(new Date(Date.UTC(y, m - 1, d)), dayOffset);
    const isoDay = jsDayToIso(dayDate.getUTCDay());
    if (!schedule.days_of_week.includes(isoDay)) continue;

    const localYmd =
      `${dayDate.getUTCFullYear()}-` +
      `${pad(dayDate.getUTCMonth() + 1)}-` +
      `${pad(dayDate.getUTCDate())}`;

    for (const window of schedule.times_of_day) {
      const { hour, minute } = midpoint(window);
      const localIso = `${localYmd}T${pad(hour)}:${pad(minute)}:00`;
      const utcIso = zonedTimeToUtc(localIso, ctx.timezone).toISOString();
      doses.push({
        user_id: ctx.userId,
        medication_id: ctx.medicationId,
        schedule_id: ctx.scheduleId,
        scheduled_for: utcIso,
        adjusted_for: utcIso,
        adjustment_reason: REASON_NONE,
        status: STATUS_PENDING,
      });
    }
  }

  return doses;
}
