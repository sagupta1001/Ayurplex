import type { ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useOnboardingStatus } from './useOnboardingStatus';

export function RequireOnboarded({ children }: { children: ReactNode }): ReactElement {
  const { loading, needsOnboarding } = useOnboardingStatus();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-dark-black/60">
        Loading…
      </div>
    );
  }
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
