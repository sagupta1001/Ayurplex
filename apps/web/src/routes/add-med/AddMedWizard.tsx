import { useReducer, useCallback } from 'react';
import type { ReactElement } from 'react';
import type { AddMedFormData } from './schema';
import type { MedicationFormData } from '@/features/medications/MedicationForm';
import { NameStep } from './steps/NameStep';
import { DosageStep } from './steps/DosageStep';
import { MealRelationshipStep } from './steps/MealRelationshipStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { RoomStep } from './steps/RoomStep';
import { DateRangeStep } from './steps/DateRangeStep';
import { ReviewStep } from './steps/ReviewStep';

const STEPS = ['name', 'dosage', 'meal', 'schedule', 'room', 'dates', 'review'] as const;
type StepId = (typeof STEPS)[number];

export type PartialAddMedData = Partial<AddMedFormData>;

interface WizardState {
  step: number;
  data: PartialAddMedData;
}

type Action =
  | { type: 'next'; patch: PartialAddMedData }
  | { type: 'back' }
  | { type: 'patch'; patch: PartialAddMedData };

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'next':
      return {
        step: Math.min(state.step + 1, STEPS.length - 1),
        data: { ...state.data, ...action.patch },
      };
    case 'back':
      return { ...state, step: Math.max(state.step - 1, 0) };
    case 'patch':
      return { ...state, data: { ...state.data, ...action.patch } };
    default:
      return state;
  }
}

export interface AddMedWizardProps {
  onSubmit: (data: AddMedFormData) => void;
  onClose: () => void;
  initial?: PartialAddMedData;
}

export function AddMedWizard({ onSubmit, onClose, initial }: AddMedWizardProps): ReactElement {
  const [state, dispatch] = useReducer(reducer, {
    step: 0,
    data: initial ?? {
      frequency: 'daily',
      days_of_week: [],
      times_of_day: [],
      preferred_room_id: null,
      end_date: null,
      instructions: null,
    },
  });

  const currentStep: StepId = STEPS[state.step] ?? 'name';

  const next = useCallback((patch: PartialAddMedData) => dispatch({ type: 'next', patch }), []);
  const back = useCallback(() => dispatch({ type: 'back' }), []);

  const handleReviewSubmit = useCallback((formData: MedicationFormData) => {
    onSubmit(formData as unknown as AddMedFormData);
  }, [onSubmit]);

  return (
    <div data-testid="add-med-wizard">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
        >
          ×
        </button>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#4D9999' }}>
          Step {state.step + 1} of {STEPS.length}
        </div>
      </header>

      <div style={{ padding: '0 16px' }}>
        {currentStep === 'name' && <NameStep data={state.data} onNext={next} />}
        {currentStep === 'dosage' && <DosageStep data={state.data} onNext={next} onBack={back} />}
        {currentStep === 'meal' && (
          <MealRelationshipStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'schedule' && (
          <ScheduleStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'room' && <RoomStep data={state.data} onNext={next} onBack={back} />}
        {currentStep === 'dates' && (
          <DateRangeStep data={state.data} onNext={next} onBack={back} />
        )}
        {currentStep === 'review' && (
          <ReviewStep data={state.data} onBack={back} onSubmit={handleReviewSubmit} />
        )}
      </div>
    </div>
  );
}
