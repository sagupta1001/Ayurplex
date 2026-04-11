import * as React from 'react';
import { supabase } from '@/lib/supabase';

export const GOOGLE_OAUTH_SCOPES =
  'openid email profile https://www.googleapis.com/auth/calendar.readonly';

export function SignInButton(): React.ReactElement {
  async function handleClick(): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: GOOGLE_OAUTH_SCOPES,
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-6 py-3 font-heading text-base font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span aria-hidden="true">G</span>
      Sign in with Google
    </button>
  );
}
