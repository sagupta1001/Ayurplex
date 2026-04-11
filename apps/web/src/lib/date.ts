// Timezone-aware date utilities. ALL date math in Ayurplex goes through this
// module — no raw `new Date()` arithmetic in feature code. Addresses spec R5
// (timezone bugs). Timestamps are stored as UTC in Supabase and converted to
// the user's IANA timezone (from `profiles.timezone`) at the edge.

import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

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
