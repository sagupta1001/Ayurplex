import type { ReactElement } from 'react';

export interface WelcomeStepProps {
  onNext: () => void;
  displayName: string;
}

export function WelcomeStep({ onNext, displayName }: WelcomeStepProps): ReactElement {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 px-6 text-center font-body">
      <h1 className="font-heading text-h2 font-semibold text-primary">
        Welcome to Ayurplex
      </h1>
      <p className="text-base text-dark-black/70">
        Hi {displayName}! Let&apos;s set up adaptive reminders that work around your day.
      </p>
      <button
        type="button"
        onClick={onNext}
        className="rounded-full bg-primary px-8 py-3 font-heading text-base font-semibold text-white hover:bg-primary/90"
      >
        Continue
      </button>
    </section>
  );
}
