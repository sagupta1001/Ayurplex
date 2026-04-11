import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import SignInPage from '@/routes/sign-in';

function PlaceholderHome(): ReactElement {
  return <div>home placeholder</div>;
}

export function App(): ReactElement {
  return (
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
  );
}
