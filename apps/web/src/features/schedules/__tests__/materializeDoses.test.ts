import { describe, it, expect } from 'vitest';
import type { MedicationScheduleInput, ScheduledDoseInsert } from '@ayurplex/shared';
import { materializeDoses } from '../materializeDoses';

const baseCtx = {
  userId: 'user-1',
  medicationId: 'med-1',
  scheduleId: 'sch-1',
  timezone: 'America/Toronto',
  startDate: '2026-04-13', // Monday
  days: 7,
};

describe('materializeDoses', () => {
  it('produces one dose per day for a single window across 7 days', () => {
    const schedule: MedicationScheduleInput = {
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      preferred_room_id: null,
    };
    const doses = materializeDoses(schedule, baseCtx);
    expect(doses).toHaveLength(7);
    expect(doses[0]?.user_id).toBe('user-1');
    expect(doses[0]?.medication_id).toBe('med-1');
    expect(doses[0]?.schedule_id).toBe('sch-1');
    expect(doses[0]?.status).toBe('pending');
    expect(doses[0]?.adjustment_reason).toBe('none');
    expect(doses[0]?.scheduled_for).toBe('2026-04-13T13:00:00.000Z');
    expect(doses[0]?.adjusted_for).toBe('2026-04-13T13:00:00.000Z');
  });

  it('produces 2 doses/day × weekdays only when days_of_week is [1..5]', () => {
    const schedule: MedicationScheduleInput = {
      frequency: 'daily',
      times_of_day: [
        { window_start: '08:00', window_end: '10:00' },
        { window_start: '20:00', window_end: '22:00' },
      ],
      days_of_week: [1, 2, 3, 4, 5],
      preferred_room_id: null,
    };
    const doses = materializeDoses(schedule, baseCtx);
    expect(doses).toHaveLength(10);
    const byDay = new Map<string, number>();
    for (const d of doses) {
      const day = d.scheduled_for.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    // UTC timestamps: Toronto EDT = UTC-4, so evening doses (21:00 local) map to
    // 01:00 UTC next calendar day. Apr 13 AM → Apr 13 UTC; Apr 13 PM → Apr 14 UTC.
    // Apr 19 (Sunday UTC) is not produced since day-of-week filter is ISO [1..5].
    expect(byDay.get('2026-04-19')).toBeUndefined();
    // Apr 17 gets 2 UTC-dated doses: Thu 21:00 local → Fri 01:00 UTC + Fri AM → Fri 13:00 UTC
    expect(byDay.get('2026-04-17')).toBe(2);
    // All 10 doses land across UTC dates Apr 13–18 (no Sunday Apr 19 UTC)
    const total = [...byDay.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(10);
  });

  it('stores scheduled_for as UTC even in a non-local timezone', () => {
    const schedule: MedicationScheduleInput = {
      frequency: 'daily',
      times_of_day: [{ window_start: '08:00', window_end: '10:00' }],
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      preferred_room_id: null,
    };
    const doses: ScheduledDoseInsert[] = materializeDoses(schedule, {
      ...baseCtx,
      timezone: 'Asia/Kolkata',
    });
    expect(doses[0]?.scheduled_for).toBe('2026-04-13T03:30:00.000Z');
  });

  it('throws when times_of_day is empty', () => {
    expect(() =>
      materializeDoses(
        {
          frequency: 'daily',
          times_of_day: [],
          days_of_week: [1, 2, 3, 4, 5, 6, 7],
          preferred_room_id: null,
        },
        baseCtx,
      ),
    ).toThrow(/at least one time window/i);
  });
});
