import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignInButton } from '@/features/auth/SignInButton';
import { supabase } from '@/lib/supabase';

export default function SignInPage(): ReactElement {
  const navigate = useNavigate();
  const [devError, setDevError] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);

  const handleDevSignIn = async (): Promise<void> => {
    setDevError(null);
    setDevBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: 'dev@ayurplex.test',
      password: 'dev-password-123',
    });
    setDevBusy(false);
    if (error) {
      setDevError(
        `${error.message}. Run "pnpm --filter @ayurplex/web seed:dev" first, then retry.`,
      );
      return;
    }
    navigate('/');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 font-body text-dark-black">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 font-heading text-h2 font-semibold text-primary">Ayurplex</h1>
        <p className="mb-10 text-base text-dark-black/70">Smart, adaptive medication reminders.</p>
        <SignInButton />
        {import.meta.env.DEV && (
          <div className="mt-6 border-t border-dark-black/10 pt-6">
            <button
              type="button"
              onClick={() => {
                void handleDevSignIn();
              }}
              disabled={devBusy}
              className="w-full rounded-full border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {devBusy ? 'Signing in…' : 'Sign in as dev user (local only)'}
            </button>
            {devError && <p className="mt-2 text-xs text-red-600">{devError}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
