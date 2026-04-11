import type { ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export function RequireAuth({ children }: { children: ReactNode }): ReactElement {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-dark-black/60">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}
