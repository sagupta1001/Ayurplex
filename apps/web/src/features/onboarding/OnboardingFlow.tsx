import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile, useUpdateProfile } from '@/features/profiles/useProfile';
import { WelcomeStep } from './WelcomeStep';

export function OnboardingFlow(): ReactElement {
  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const navigate = useNavigate();

  async function finish(): Promise<void> {
    const existing = (profile?.notification_prefs ?? {}) as Record<string, unknown>;
    await updateProfileMutation.mutateAsync({
      notification_prefs: { ...existing, onboarding_complete: true },
    });
    navigate('/', { replace: true });
  }

  return (
    <WelcomeStep
      displayName={profile?.display_name ?? 'there'}
      onNext={finish}
    />
  );
}
