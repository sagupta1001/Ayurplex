import type { ReactElement } from 'react';
import { SignInButton } from '@/features/auth/SignInButton';

export default function SignInPage(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 font-body text-dark-black">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 font-heading text-h2 font-semibold text-primary">Ayurplex</h1>
        <p className="mb-10 text-base text-dark-black/70">Smart, adaptive medication reminders.</p>
        <SignInButton />
      </div>
    </main>
  );
}
