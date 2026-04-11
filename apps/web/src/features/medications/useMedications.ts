import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Medication, MedicationInput } from '@ayurplex/shared';
import {
  listActiveMedications,
  createMedication,
  deactivateMedication,
} from './api';

export const MEDICATIONS_QUERY_KEY = ['medications', 'active'] as const;

export interface UseMedicationsResult {
  medications: Medication[];
  isLoading: boolean;
  error: unknown;
}

export function useMedications(): UseMedicationsResult {
  const query = useQuery({
    queryKey: MEDICATIONS_QUERY_KEY,
    queryFn: listActiveMedications,
  });
  return {
    medications: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MedicationInput) => createMedication(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
    },
  });
}

export function useDeactivateMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateMedication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
    },
  });
}
