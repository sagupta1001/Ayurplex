import type { ReactElement } from 'react';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';

export default function OnboardingPage(): ReactElement {
  return (
    <main className="min-h-screen bg-white font-body text-dark-black">
      <OnboardingFlow />
    </main>
  );
}
