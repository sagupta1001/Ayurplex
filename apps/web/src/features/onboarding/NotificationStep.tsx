import type { ReactElement } from 'react';

export interface NotificationStepProps {
  onNext: (result: { granted: boolean }) => void;
}

type WindowWithNotification = typeof window & {
  Notification?: {
    requestPermission: () => Promise<NotificationPermission>;
    permission: NotificationPermission;
  };
};

function getNotification(): WindowWithNotification['Notification'] | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as WindowWithNotification).Notification;
}

export function NotificationStep({ onNext }: NotificationStepProps): ReactElement {
  const notification = getNotification();
  const supported = Boolean(notification);

  async function handleEnable(): Promise<void> {
    if (!notification) {
      onNext({ granted: false });
      return;
    }
    try {
      const perm = await notification.requestPermission();
      onNext({ granted: perm === 'granted' });
    } catch {
      onNext({ granted: false });
    }
  }

  if (!supported) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center font-body">
        <h2 className="font-heading text-2xl font-semibold text-primary">Reminders</h2>
        <p className="text-sm text-dark-black/70">
          Push notifications are not supported in this browser. You&apos;ll still see in-app
          reminders.
        </p>
        <button
          type="button"
          onClick={() => onNext({ granted: false })}
          className="rounded-full bg-primary px-6 py-2 font-heading text-sm font-semibold text-white"
        >
          Continue
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center font-body">
      <h2 className="font-heading text-2xl font-semibold text-primary">Turn on reminders</h2>
      <p className="text-sm text-dark-black/70">
        Ayurplex nudges you when it&apos;s time to take a dose — smartly shifted around meetings
        and meals. We recommend enabling notifications.
      </p>
      <button
        type="button"
        onClick={handleEnable}
        className="rounded-full bg-primary px-6 py-2 font-heading text-sm font-semibold text-white hover:bg-primary/90"
      >
        Turn on reminders
      </button>
      <button
        type="button"
        onClick={() => onNext({ granted: false })}
        className="text-sm font-semibold text-dark-black/60 underline"
      >
        Maybe later
      </button>
    </section>
  );
}
