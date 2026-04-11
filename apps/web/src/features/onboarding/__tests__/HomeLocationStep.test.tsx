import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { HomeLocationStep } from '../HomeLocationStep';

vi.mock('react-map-gl/maplibre', () => {
  type MockMapProps = {
    children?: ReactNode;
    onClick?: (e: { lngLat: { lng: number; lat: number } }) => void;
  };
  return {
    __esModule: true,
    default: ({ children, onClick }: MockMapProps) => (
      <div
        data-testid="map"
        onClick={() => onClick?.({ lngLat: { lng: -79.38, lat: 43.65 } })}
      >
        {children}
      </div>
    ),
    Marker: ({ children }: { children?: ReactNode }) => (
      <div data-testid="marker">{children}</div>
    ),
  };
});

describe('HomeLocationStep', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(
          (success: (pos: { coords: { latitude: number; longitude: number } }) => void) =>
            success({ coords: { latitude: 40, longitude: -74 } }),
        ),
      },
    });
  });

  it('saves lat/lng/radius when a pin is placed and Save is clicked', async () => {
    const onSave = vi.fn();
    const onSkip = vi.fn();
    render(<HomeLocationStep onSave={onSave} onSkip={onSkip} />);

    await userEvent.click(screen.getByTestId('map'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({ lat: 43.65, lng: -79.38, radius: 50 });
  });

  it('calls onSkip when the skip button is clicked', async () => {
    const onSave = vi.fn();
    const onSkip = vi.fn();
    render(<HomeLocationStep onSave={onSave} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('uses geolocation when the "use my location" button is clicked', async () => {
    const onSave = vi.fn();
    const onSkip = vi.fn();
    render(<HomeLocationStep onSave={onSave} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({ lat: 40, lng: -74, radius: 50 });
  });
});
