import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RoomStep } from '../RoomStep';

vi.mock('@/features/rooms/api', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
}));

import { listRooms, createRoom } from '@/features/rooms/api';

const mockListRooms = listRooms as unknown as ReturnType<typeof vi.fn>;
const mockCreateRoom = createRoom as unknown as ReturnType<typeof vi.fn>;

function wrap(children: ReactNode): ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

const baseRoom = {
  user_id: 'user-1',
  icon: 'home',
  created_at: '',
  updated_at: '',
};

describe('RoomStep', () => {
  it('lists rooms and lets the user select one', async () => {
    mockListRooms.mockResolvedValue([
      { ...baseRoom, id: 'room-1', name: 'Kitchen' },
      { ...baseRoom, id: 'room-2', name: 'Bedroom' },
    ]);
    const onNext = vi.fn();

    render(wrap(<RoomStep data={{}} onNext={onNext} onBack={() => undefined} />));

    await waitFor(() => expect(screen.getByText('Kitchen')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Kitchen'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ preferred_room_id: 'room-1' });
  });

  it('lets the user add a new room inline', async () => {
    mockListRooms.mockResolvedValue([]);
    mockCreateRoom.mockResolvedValue({
      ...baseRoom,
      id: 'room-new',
      name: 'Office',
    });

    const onNext = vi.fn();
    render(wrap(<RoomStep data={{}} onNext={onNext} onBack={() => undefined} />));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add a new room/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /add a new room/i }));
    fireEvent.change(screen.getByLabelText(/new room name/i), {
      target: { value: 'Office' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));

    await waitFor(() =>
      expect(mockCreateRoom).toHaveBeenCalledWith({ name: 'Office' }),
    );
  });

  it('allows skipping room selection', async () => {
    mockListRooms.mockResolvedValue([]);
    const onNext = vi.fn();
    render(wrap(<RoomStep data={{}} onNext={onNext} onBack={() => undefined} />));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ preferred_room_id: null });
  });
});
