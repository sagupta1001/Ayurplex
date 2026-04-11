import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dosageStepSchema } from '../schema';
import type { StepProps } from './types';

interface DosageFields {
  dosage_amount: number;
  dosage_unit: string;
  form: 'tablet' | 'capsule' | 'liquid';
  instructions: string | null;
}

export function DosageStep({ data, onNext, onBack }: StepProps): ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DosageFields>({
    resolver: zodResolver(dosageStepSchema),
    defaultValues: {
      dosage_amount: data.dosage_amount ?? 0,
      dosage_unit: data.dosage_unit ?? 'mg',
      form: data.form ?? 'tablet',
      instructions: data.instructions ?? null,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onNext({
          dosage_amount: values.dosage_amount,
          dosage_unit: values.dosage_unit,
          form: values.form,
          instructions: values.instructions && values.instructions.length > 0 ? values.instructions : null,
        }),
      )}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        How much and what form?
      </h2>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Amount</span>
        <input
          aria-label="Amount"
          type="number"
          step="any"
          {...register('dosage_amount', { valueAsNumber: true })}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        />
        {errors.dosage_amount && (
          <span style={{ color: '#B3261E', fontSize: 12 }}>{errors.dosage_amount.message}</span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Unit</span>
        <input
          aria-label="Unit"
          type="text"
          {...register('dosage_unit')}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Form</span>
        <select
          aria-label="Form"
          {...register('form')}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        >
          <option value="tablet">Tablet</option>
          <option value="capsule">Capsule</option>
          <option value="liquid">Liquid</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Instructions (optional)</span>
        <input
          aria-label="Instructions"
          type="text"
          {...register('instructions')}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E5F4F2', fontSize: 16 }}
        />
      </label>

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
          type="submit"
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
    </form>
  );
}
