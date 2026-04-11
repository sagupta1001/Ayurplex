import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function SignOutButton(): ReactElement {
  const navigate = useNavigate();

  async function handleClick(): Promise<void> {
    await supabase.auth.signOut();
    navigate('/sign-in', { replace: true });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-full border border-dark-black/20 px-4 py-2 text-sm font-semibold text-dark-black/80 hover:bg-white"
    >
      Sign out
    </button>
  );
}
