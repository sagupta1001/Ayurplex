import { useState } from 'react';
import type { ReactElement } from 'react';
import type { StepProps } from './types';

export function NameStep({ data, onNext }: StepProps): ReactElement {
  const [name, setName] = useState(data.name ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext({ name });
      }}
    >
      <label>
        Medication name
        <input aria-label="Medication name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit">Next</button>
    </form>
  );
}
