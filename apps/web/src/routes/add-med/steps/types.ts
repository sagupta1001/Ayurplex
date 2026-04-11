import type { PartialAddMedData } from '../AddMedWizard';

export interface StepProps {
  data: PartialAddMedData;
  onNext: (patch: PartialAddMedData) => void;
  onBack?: () => void;
}
