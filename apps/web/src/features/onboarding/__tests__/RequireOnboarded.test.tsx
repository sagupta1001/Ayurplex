import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireOnboarded } from '../RequireOnboarded';

const { mockStatus } = vi.hoisted(() => ({ mockStatus: vi.fn() }));

vi.mock('../useOnboardingStatus', () => ({
  useOnboardingStatus: () => mockStatus(),
}));

describe('RequireOnboarded', () => {
  it('redirects to /onboarding when needsOnboarding is true', () => {
    mockStatus.mockReturnValue({ loading: false, needsOnboarding: true });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <RequireOnboarded>
                <div>home</div>
              </RequireOnboarded>
            }
          />
          <Route path="/onboarding" element={<div>onboarding page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('onboarding page')).toBeInTheDocument();
  });

  it('renders children when already onboarded', () => {
    mockStatus.mockReturnValue({ loading: false, needsOnboarding: false });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <RequireOnboarded>
                <div>home</div>
              </RequireOnboarded>
            }
          />
          <Route path="/onboarding" element={<div>onboarding page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
