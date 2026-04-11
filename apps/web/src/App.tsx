import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import SignInPage from '@/routes/sign-in';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function PlaceholderHome(): ReactElement {
  return <div>home placeholder</div>;
}

export function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <PlaceholderHome />
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
