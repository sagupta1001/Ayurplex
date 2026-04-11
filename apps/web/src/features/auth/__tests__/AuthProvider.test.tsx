import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';

const { fakeSession, authStateListeners } = vi.hoisted(() => {
  const fakeSession = {
    access_token: 'abc',
    refresh_token: 'def',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'user-1', email: 'test@example.com' },
  } as unknown as Session;

  const authStateListeners: Array<(event: string, session: unknown) => void> = [];

  return { fakeSession, authStateListeners };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: fakeSession }, error: null }),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        authStateListeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

function Probe(): JSX.Element {
  const { user, session, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user?.id ?? 'none'}</span>
      <span data-testid="session">{session?.access_token ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    authStateListeners.length = 0;
  });

  it('starts loading then resolves to the current session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('user-1');
    expect(screen.getByTestId('session')).toHaveTextContent('abc');
  });

  it('updates when onAuthStateChange fires', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));

    authStateListeners[0]?.('SIGNED_OUT', null);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });
  });
});
