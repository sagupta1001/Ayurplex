// Timezone-aware date utilities. ALL date math in Ayurplex goes through this
// module — no raw `new Date()` arithmetic in feature code. Addresses spec R5
// (timezone bugs). Timestamps are stored as UTC in Supabase and converted to
// the user's IANA timezone (from `profiles.timezone`) at the edge.

import { toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays as dfAddDays } from 'date-fns';

export type TimeFormat = '12h' | '24h';

/**
 * Convert a UTC ISO string into a Date object whose local getters
 * (getHours, getMinutes, ...) read as wall-clock time in `timezone`.
 */
export function toUserTimezone(utcIso: string, timezone: string): Date {
  return toZonedTime(utcIso, timezone);
}

/**
 * Format a UTC ISO string as a wall-clock time string in the user's timezone.
 */
export function formatTime(utcIso: string, timezone: string, format: TimeFormat): string {
  const pattern = format === '12h' ? 'hh:mm a' : 'HH:mm';
  return formatInTimeZone(new Date(utcIso), timezone, pattern);
}

/**
 * Return true if the wall-clock time of `utcIso` in `timezone` falls within
 * the inclusive [startHHMM, endHHMM] window on the same local day.
 *
 * startHHMM / endHHMM are zero-padded 24h strings like "08:00" / "11:30".
 */
export function isWithinWindow(
  utcIso: string,
  startHHMM: string,
  endHHMM: string,
  timezone: string,
): boolean {
  const wallClock = formatInTimeZone(new Date(utcIso), timezone, 'HH:mm');
  return wallClock >= startHHMM && wallClock <= endHHMM;
}

/**
 * Convert a local wall-clock ISO (e.g. "2026-04-13T09:00:00") in `timezone`
 * into the corresponding UTC Date. Thin wrapper over date-fns-tz v3's
 * `fromZonedTime`, re-exported under its v2 name so feature code reads
 * consistently.
 */
export function zonedTimeToUtc(localIso: string, timezone: string): Date {
  return fromZonedTime(localIso, timezone);
}

/** Add `days` calendar days to a UTC Date. Pure re-export of date-fns' addDays. */
export function addDays(date: Date, days: number): Date {
  return dfAddDays(date, days);
}

/**
 * Format a Date as a local 12h time string in the given IANA timezone.
 * Example: new Date('2026-04-11T13:00:00Z') + 'America/Toronto' → '9:00 AM'
 */
export function formatLocalTime(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'h:mm a');
}

/**
 * Return the UTC Date corresponding to midnight 00:00:00 of the local calendar
 * day in `timezone` that contains `now`.
 *
 * Uses formatInTimeZone to render the local YYYY-MM-DD, then maps that local
 * midnight back to UTC via zonedTimeToUtc.
 */
export function startOfLocalDay(now: Date, timezone: string): Date {
  const localYmd = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  return zonedTimeToUtc(`${localYmd}T00:00:00`, timezone);
}
