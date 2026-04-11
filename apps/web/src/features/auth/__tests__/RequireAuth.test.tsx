import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { RequireAuth } from '../RequireAuth';
import { AuthProvider } from '../AuthProvider';

const state = vi.hoisted(() => ({ currentSession: null as Session | null }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.currentSession }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

describe('RequireAuth', () => {
  beforeEach(() => {
    state.currentSession = null;
  });

  it('redirects to /sign-in when there is no user', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <div>protected</div>
                </RequireAuth>
              }
            />
            <Route path="/sign-in" element={<div>sign in page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('sign in page')).toBeInTheDocument());
  });

  it('renders children when a user is present', async () => {
    state.currentSession = { user: { id: 'u1' }, access_token: 'a' } as unknown as Session;
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <div>protected</div>
                </RequireAuth>
              }
            />
            <Route path="/sign-in" element={<div>sign in page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument());
  });
});
