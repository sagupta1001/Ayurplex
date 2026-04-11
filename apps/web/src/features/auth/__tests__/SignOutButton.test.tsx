import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SignOutButton } from '../SignOutButton';

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: () => signOut() } },
}));

describe('SignOutButton', () => {
  it('calls supabase.auth.signOut and navigates to /sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<SignOutButton />} />
          <Route path="/sign-in" element={<div>sign in page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
    await screen.findByText('sign in page');
  });
});
