import type { ReactElement } from 'react';
import type { PartialAddMedData } from '../AddMedWizard';

export interface ReviewStepProps {
  data: PartialAddMedData;
  onBack: () => void;
  onSubmit: () => void;
}

export function ReviewStep({ onBack, onSubmit }: ReviewStepProps): ReactElement {
  return (
    <div>
      <h2>Review</h2>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" onClick={onSubmit}>
        Save medication
      </button>
    </div>
  );
}
