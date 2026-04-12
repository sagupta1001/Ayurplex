import { useEffect, useRef } from 'react';
import { useProfile, useUpdateProfile } from './useProfile';

/**
 * Auto-detect browser timezone and update profile if still defaulting to 'UTC'.
 * Runs once per mount. No-ops if timezone is already set to a real IANA zone.
 */
export function useTimezoneSync(): void {
  const { data: profile } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current || !profile) return;
    if (profile.timezone && profile.timezone !== 'UTC') return;

    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== 'UTC') {
      synced.current = true;
      updateProfile({ timezone: detected });
    }
  }, [profile, updateProfile]);
}
