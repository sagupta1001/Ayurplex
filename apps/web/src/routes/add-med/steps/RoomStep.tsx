import { useState } from 'react';
import type { ReactElement } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRooms, createRoom } from '@/features/rooms/api';
import type { StepProps } from './types';

export function RoomStep({ data, onNext, onBack }: StepProps): ReactElement {
  const qc = useQueryClient();
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: listRooms });
  const [selected, setSelected] = useState<string | null>(data.preferred_room_id ?? null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const createMut = useMutation({
    mutationFn: (name: string) => createRoom({ name }),
    onSuccess: (room) => {
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      setSelected(room.id);
      setShowNew(false);
      setNewName('');
    },
  });

  const rooms = roomsQuery.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        Preferred room? (optional)
      </h2>

      {roomsQuery.isLoading && <p>Loading…</p>}
      {!roomsQuery.isLoading && rooms.length === 0 && !showNew && (
        <p style={{ color: '#4D9999' }}>No rooms yet — you can skip or add one.</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rooms.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 12,
                borderRadius: 12,
                border: selected === r.id ? '2px solid #19AFA2' : '1px solid #E5F4F2',
                background: '#FFFFFF',
                marginBottom: 8,
                cursor: 'pointer',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 16,
                color: '#092C4C',
              }}
            >
              {r.name}
            </button>
          </li>
        ))}
      </ul>

      {showNew ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>New room name</span>
            <input
              aria-label="New room name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (newName.trim().length > 0) {
                createMut.mutate(newName.trim());
              }
            }}
            style={{
              background: '#007972',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 999,
              padding: '12px 24px',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Create room
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          style={{
            background: 'none',
            border: '1px dashed #007972',
            color: '#007972',
            borderRadius: 12,
            padding: '12px 24px',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          + Add a new room
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid #007972',
            color: '#007972',
            borderRadius: 999,
            padding: '12px 24px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onNext({ preferred_room_id: selected })}
          style={{
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 999,
            padding: '12px 24px',
            cursor: 'pointer',
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
