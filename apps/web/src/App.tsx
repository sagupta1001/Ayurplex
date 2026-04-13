import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireOnboarded } from '@/features/onboarding/RequireOnboarded';
import SignInPage from '@/routes/sign-in';
import OnboardingPage from '@/routes/onboarding';
import HomePage from '@/routes/home';
import { AddMedRoute } from '@/routes/add-med';
import { EditMedRoute } from '@/routes/edit-med';
import { UploadPrescriptionRoute } from '@/routes/upload-prescription';
import { ReviewScreen } from '@/routes/upload-prescription/ReviewScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <HomePage />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route
              path="/add-med"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <AddMedRoute />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route
              path="/edit-med/:id"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <EditMedRoute />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route
              path="/upload-prescription"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <UploadPrescriptionRoute />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route
              path="/upload-prescription/review/:id"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <ReviewScreen />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
