import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useOnboardingStatus } from '../useOnboardingStatus';

const { mockProfile } = vi.hoisted(() => ({ mockProfile: vi.fn() }));

vi.mock('@/features/profiles/useProfile', () => ({
  useProfile: () => mockProfile(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useOnboardingStatus', () => {
  it('returns loading while profile query is loading', () => {
    mockProfile.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('needs onboarding when onboarding_complete is falsy', async () => {
    mockProfile.mockReturnValue({
      data: { home_lat: null, home_lng: null, notification_prefs: {} },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsOnboarding).toBe(true);
  });

  it('does not need onboarding when onboarding_complete is true', async () => {
    mockProfile.mockReturnValue({
      data: {
        home_lat: null,
        home_lng: null,
        notification_prefs: { onboarding_complete: true },
      },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('still needs onboarding when home_lat is set but onboarding_complete is falsy', async () => {
    mockProfile.mockReturnValue({
      data: { home_lat: 43.65, home_lng: -79.38, notification_prefs: {} },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsOnboarding).toBe(true);
  });
});
