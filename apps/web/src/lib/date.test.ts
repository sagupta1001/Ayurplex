import { describe, it, expect } from 'vitest';
import { toUserTimezone, formatTime, isWithinWindow } from './date';

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
    expect(
      isWithinWindow('2026-06-15T14:00:00Z', '08:00', '11:00', 'America/Toronto'),
    ).toBe(true);
  });

  it('returns false when the UTC time falls outside the zoned window', () => {
    // 14:00 UTC = 10:00 EDT Toronto; window 11:30-13:00 local → outside
    expect(
      isWithinWindow('2026-06-15T14:00:00Z', '11:30', '13:00', 'America/Toronto'),
    ).toBe(false);
  });

  it('handles a window that has already closed for the day', () => {
    // 23:00 UTC = 19:00 EDT; window 08:00-11:00 → outside
    expect(
      isWithinWindow('2026-06-15T23:00:00Z', '08:00', '11:00', 'America/Toronto'),
    ).toBe(false);
  });
});
