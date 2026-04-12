export type {
  Prescription,
  PrescriptionStatus,
  VisionParsed,
  ExtractedMedication,
  ConfidenceScores,
} from '@ayurplex/shared';

/** State of the upload + parse flow in the client. */
export type UploadPhase = 'idle' | 'uploading' | 'creating' | 'parsing' | 'done' | 'error';
