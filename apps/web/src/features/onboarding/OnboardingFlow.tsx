import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile, useUpdateProfile } from '@/features/profiles/useProfile';
import { WelcomeStep } from './WelcomeStep';
import { HomeLocationStep } from './HomeLocationStep';
import type { HomeLocationValue } from './HomeLocationStep';
import { NotificationStep } from './NotificationStep';

type Step = 'welcome' | 'home' | 'notifications';

export function OnboardingFlow(): ReactElement {
  const [step, setStep] = useState<Step>('welcome');
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

  async function handleHomeSave(v: HomeLocationValue): Promise<void> {
    await updateProfileMutation.mutateAsync({
      home_lat: v.lat,
      home_lng: v.lng,
      home_radius_m: v.radius,
    });
    setStep('notifications');
  }

  if (step === 'welcome') {
    return (
      <WelcomeStep
        displayName={profile?.display_name ?? 'there'}
        onNext={() => setStep('home')}
      />
    );
  }

  if (step === 'home') {
    return <HomeLocationStep onSave={handleHomeSave} onSkip={() => setStep('notifications')} />;
  }

  return <NotificationStep onNext={finish} />;
}
