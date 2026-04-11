import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationStep } from '../NotificationStep';

type MockNotification = {
  requestPermission: ReturnType<typeof vi.fn>;
  permission: NotificationPermission;
};

const globalAny = globalThis as unknown as { Notification?: MockNotification | undefined };
const original = globalAny.Notification;

describe('NotificationStep', () => {
  beforeEach(() => {
    globalAny.Notification = {
      requestPermission: vi.fn().mockResolvedValue('granted'),
      permission: 'default',
    };
  });
  afterEach(() => {
    globalAny.Notification = original;
  });

  it('calls Notification.requestPermission and then onNext', async () => {
    const onNext = vi.fn();
    render(<NotificationStep onNext={onNext} />);
    await userEvent.click(screen.getByRole('button', { name: /turn on reminders/i }));
    expect(globalAny.Notification?.requestPermission).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });

  it('still calls onNext when "Maybe later" is clicked', async () => {
    const onNext = vi.fn();
    render(<NotificationStep onNext={onNext} />);
    await userEvent.click(screen.getByRole('button', { name: /maybe later/i }));
    expect(onNext).toHaveBeenCalled();
  });

  it('falls back gracefully when Notification API is missing', async () => {
    globalAny.Notification = undefined;
    const onNext = vi.fn();
    render(<NotificationStep onNext={onNext} />);
    expect(screen.getByText(/not supported/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalled();
  });
});
