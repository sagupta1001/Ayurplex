import { useState, useCallback } from 'react';
import type { VisionParsed } from '@ayurplex/shared';
import type { UploadPhase } from './types';
import {
  uploadPrescriptionImage,
  createPrescription,
  parsePrescription,
} from './api';

export interface UsePrescriptionUploadResult {
  phase: UploadPhase;
  error: string | null;
  prescriptionId: string | null;
  visionParsed: VisionParsed | null;
  startUpload: (file: File) => Promise<void>;
  reset: () => void;
}

export function usePrescriptionUpload(): UsePrescriptionUploadResult {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [visionParsed, setVisionParsed] = useState<VisionParsed | null>(null);

  const startUpload = useCallback(async (file: File) => {
    try {
      setError(null);
      setPhase('uploading');
      const { storagePath } = await uploadPrescriptionImage(file);

      setPhase('creating');
      const prescription = await createPrescription(storagePath);
      setPrescriptionId(prescription.id);

      setPhase('parsing');
      const parsed = await parsePrescription(prescription.id);
      setVisionParsed(parsed);

      setPhase('done');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setPrescriptionId(null);
    setVisionParsed(null);
  }, []);

  return { phase, error, prescriptionId, visionParsed, startUpload, reset };
}
