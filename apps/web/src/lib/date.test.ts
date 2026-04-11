import { describe, it, expect } from 'vitest';
import { toUserTimezone, formatTime, isWithinWindow, startOfLocalDay, formatLocalTime } from './date';

describe('toUserTimezone', () => {
  it('converts a UTC ISO string to a zoned Date in America/Toronto', () => {
    // 2026-06-15T14:00:00Z = 10:00 EDT (UTC-4)
    const zoned = toUserTimezone('2026-06-15T14:00:00Z', 'America/Toronto');
    expect(zoned.getHours()).toBe(10);
    expect(zoned.getMinutes()).toBe(0);
  });

  it('handles DST fall-back transition (Toronto, 2026-11-01)', () => {
    // 2026-11-01T05:30:00Z = 01:30 EDT (before fall back)
    const zoned = toUserTimezone('2026-11-01T05:30:00Z', 'America/Toronto');
    expect(zoned.getHours()).toBe(1);
    expect(zoned.getMinutes()).toBe(30);
  });
});

describe('formatTime', () => {
  it('formats a UTC ISO string as 12h time in user tz', () => {
    expect(formatTime('2026-06-15T14:00:00Z', 'America/Toronto', '12h')).toBe('10:00 AM');
  });

  it('formats a UTC ISO string as 24h time in user tz', () => {
    expect(formatTime('2026-06-15T14:00:00Z', 'America/Toronto', '24h')).toBe('10:00');
  });
});

describe('isWithinWindow', () => {
  it('returns true when the UTC time falls inside the zoned window', () => {
    // 14:00 UTC = 10:00 EDT Toronto; window 08:00-11:00 local
    expect(isWithinWindow('2026-06-15T14:00:00Z', '08:00', '11:00', 'America/Toronto')).toBe(true);
  });

  it('returns false when the UTC time falls outside the zoned window', () => {
    // 14:00 UTC = 10:00 EDT Toronto; window 11:30-13:00 local → outside
    expect(isWithinWindow('2026-06-15T14:00:00Z', '11:30', '13:00', 'America/Toronto')).toBe(false);
  });

  it('handles a window that has already closed for the day', () => {
    // 23:00 UTC = 19:00 EDT; window 08:00-11:00 → outside
    expect(isWithinWindow('2026-06-15T23:00:00Z', '08:00', '11:00', 'America/Toronto')).toBe(false);
  });
});

describe('formatLocalTime', () => {
  it('formats a UTC Date as local 12h time in a timezone', () => {
    // 13:00 UTC → 9:00 AM Toronto EDT
    expect(formatLocalTime(new Date('2026-04-11T13:00:00Z'), 'America/Toronto')).toBe('9:00 AM');
  });
});

describe('startOfLocalDay', () => {
  it('returns UTC midnight of the local day in the given timezone', () => {
    // 2026-04-11T18:00:00Z = 2026-04-11 14:00 local Toronto (EDT, UTC-4)
    const result = startOfLocalDay(new Date('2026-04-11T18:00:00Z'), 'America/Toronto');
    // 2026-04-11 00:00 Toronto EDT = 2026-04-11T04:00:00Z
    expect(result.toISOString()).toBe('2026-04-11T04:00:00.000Z');
  });

  it('handles a non-local timezone ahead of UTC', () => {
    // 2026-04-11T18:00:00Z = 2026-04-11 23:30 IST
    const result = startOfLocalDay(new Date('2026-04-11T18:00:00Z'), 'Asia/Kolkata');
    // 2026-04-11 00:00 IST = 2026-04-10T18:30:00Z
    expect(result.toISOString()).toBe('2026-04-10T18:30:00.000Z');
  });
});
