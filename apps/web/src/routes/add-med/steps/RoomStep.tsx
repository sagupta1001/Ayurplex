import type { ReactElement } from 'react';
import type { StepProps } from './types';

export function RoomStep({ onNext, onBack }: StepProps): ReactElement {
  return (
    <div>
      <p>Room selection (optional)</p>
      {onBack && (
        <button type="button" onClick={onBack}>
          Back
        </button>
      )}
      <button type="button" onClick={() => onNext({ preferred_room_id: null })}>
        Next
      </button>
    </div>
  );
}
