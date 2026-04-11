import type { ReactElement } from 'react';
import { useProfile } from '@/features/profiles/useProfile';
import { SignOutButton } from '@/features/auth/SignOutButton';

export default function HomePage(): ReactElement {
  const { data: profile } = useProfile();

  return (
    <main className="min-h-screen bg-white px-6 py-10 font-body text-dark-black">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-primary">
          Welcome, {profile?.display_name ?? 'there'}
        </h1>
        <SignOutButton />
      </header>
      <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-dark-black/10 bg-white/60 p-8 text-center">
        <p className="text-dark-black/70">Your medications will appear here.</p>
        <button
          type="button"
          disabled
          className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/40 text-2xl text-white"
          aria-label="Add medication (coming soon)"
        >
          +
        </button>
      </section>
    </main>
  );
}
