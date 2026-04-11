import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
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

vi.mock('react-map-gl/maplibre', () => {
  type MockMapProps = {
    children?: ReactNode;
    onClick?: (e: { lngLat: { lng: number; lat: number } }) => void;
  };
  return {
    __esModule: true,
    default: ({ children, onClick }: MockMapProps) => (
      <div data-testid="map" onClick={() => onClick?.({ lngLat: { lng: -79.38, lat: 43.65 } })}>
        {children}
      </div>
    ),
    Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

const globalRecord = globalThis as Record<string, unknown>;
const originalNotification = globalRecord['Notification'];

beforeEach(() => {
  updateProfile.mockClear();
  globalRecord['Notification'] = {
    requestPermission: vi.fn().mockResolvedValue('granted'),
    permission: 'default' as NotificationPermission,
  };
});
afterEach(() => {
  globalRecord['Notification'] = originalNotification;
});

describe('OnboardingFlow', () => {
  it('walks welcome -> home -> notifications -> /', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingFlow />} />
          <Route path="/" element={<div>home route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Welcome
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Home location
    await userEvent.click(screen.getByTestId('map'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        home_lat: 43.65,
        home_lng: -79.38,
        home_radius_m: 50,
      }),
    );

    // Notifications
    await userEvent.click(screen.getByRole('button', { name: /turn on reminders/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        notification_prefs: { onboarding_complete: true },
      }),
    );
    await waitFor(() => expect(screen.getByText('home route')).toBeInTheDocument());
  });
});
