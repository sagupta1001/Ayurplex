import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OnboardingFlow } from '../OnboardingFlow';

const { updateProfile } = vi.hoisted(() => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/profiles/api', () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
  getProfile: vi.fn().mockResolvedValue({
    user_id: 'u1',
    display_name: 'Test',
    notification_prefs: {},
    home_lat: null,
    home_lng: null,
  }),
}));

vi.mock('@/features/profiles/useProfile', () => ({
  useProfile: () => ({
    data: { display_name: 'Test', notification_prefs: {} },
    isLoading: false,
  }),
  useUpdateProfile: () => ({ mutateAsync: updateProfile }),
}));

beforeEach(() => {
  updateProfile.mockClear();
});

describe('OnboardingFlow', () => {
  it('walks welcome -> continue -> marks onboarding complete -> /', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingFlow />} />
          <Route path="/" element={<div>home route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Welcome step
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        notification_prefs: { onboarding_complete: true },
      }),
    );
    await waitFor(() => expect(screen.getByText('home route')).toBeInTheDocument());
  });
});
