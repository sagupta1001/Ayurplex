import { useState } from 'react';
import type { ReactElement } from 'react';
import type { StepProps } from './types';

export function DosageStep({ data, onNext, onBack }: StepProps): ReactElement {
  const [amount, setAmount] = useState(data.dosage_amount?.toString() ?? '');
  const [unit, setUnit] = useState(data.dosage_unit ?? '');
  const [form, setForm] = useState(data.form ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext({
          dosage_amount: Number(amount),
          dosage_unit: unit,
          form: form as 'tablet' | 'capsule' | 'liquid',
          instructions: null,
        });
      }}
    >
      <label>
        Amount
        <input aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        Unit
        <input aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </label>
      <label>
        Form
        <input aria-label="Form" value={form} onChange={(e) => setForm(e.target.value)} />
      </label>
      {onBack && (
        <button type="button" onClick={onBack}>
          Back
        </button>
      )}
      <button type="submit">Next</button>
    </form>
  );
}
