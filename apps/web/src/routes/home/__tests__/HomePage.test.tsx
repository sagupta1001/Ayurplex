import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../index';

vi.mock('@/features/profiles/useProfile', () => ({
  useProfile: () => ({
    data: { display_name: 'Satya', notification_prefs: {} },
    isLoading: false,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
}));

describe('HomePage', () => {
  it('greets the user by display name', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/welcome, satya/i)).toBeInTheDocument();
    expect(screen.getByText(/your medications will appear here/i)).toBeInTheDocument();
  });
});
