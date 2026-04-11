import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { nameStepSchema } from '../schema';
import type { StepProps } from './types';

interface NameFields {
  name: string;
}

export function NameStep({ data, onNext }: StepProps): ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameFields>({
    resolver: zodResolver(nameStepSchema, undefined, { mode: 'sync' }),
    defaultValues: { name: data.name ?? '' },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onNext({ name: values.name }))}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h2 style={{ fontFamily: 'Lexend, sans-serif', fontSize: 22, color: '#092C4C' }}>
        What&apos;s the medication name?
      </h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14 }}>Medication name</span>
        <input
          aria-label="Medication name"
          {...register('name')}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #E5F4F2',
            fontSize: 16,
          }}
        />
        {errors.name && (
          <span style={{ color: '#B3261E', fontSize: 12 }}>{errors.name.message}</span>
        )}
      </label>
      <button
        type="submit"
        style={{
          alignSelf: 'flex-end',
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
    </form>
  );
}
