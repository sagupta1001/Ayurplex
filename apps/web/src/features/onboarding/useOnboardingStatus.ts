import { useProfile } from '@/features/profiles/useProfile';

export interface OnboardingStatus {
  loading: boolean;
  needsOnboarding: boolean;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { data: profile, isLoading } = useProfile();

  if (isLoading || !profile) {
    return { loading: true, needsOnboarding: false };
  }

  const prefs = (profile.notification_prefs ?? {}) as Record<string, unknown>;
  const onboardingComplete = Boolean(prefs.onboarding_complete);

  return {
    loading: false,
    needsOnboarding: !onboardingComplete,
  };
}
