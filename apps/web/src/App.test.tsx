import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { App } from './App';

const state = vi.hoisted(() => ({ currentSession: null as Session | null }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.currentSession }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

describe('<App />', () => {
  beforeEach(() => {
    state.currentSession = null;
    window.history.pushState('', '', '/');
  });

  it('redirects unauthenticated users to sign-in page', async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Ayurplex' })).toBeInTheDocument(),
    );
  });
});
