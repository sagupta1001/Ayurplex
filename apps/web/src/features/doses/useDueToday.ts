import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScheduledDose } from '@ayurplex/shared';
import { listDueToday, markTaken as apiMarkTaken, markSkipped as apiMarkSkipped } from './api';

export const DOSES_TODAY_QUERY_KEY = ['doses', 'today'] as const;

export interface UseDueTodayOptions {
  timezone: string;
}

export interface UseDueTodayResult {
  doses: ScheduledDose[];
  takenCount: number;
  totalCount: number;
  isLoading: boolean;
  error: unknown;
  markTaken: (doseId: string) => Promise<void>;
  markSkipped: (doseId: string) => Promise<void>;
}

export function useDueToday(options: UseDueTodayOptions): UseDueTodayResult {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: DOSES_TODAY_QUERY_KEY,
    queryFn: () => listDueToday({ timezone: options.timezone }),
    staleTime: 60_000,
  });

  // Local optimistic overrides: map of doseId -> partial status override
  const [overrides, setOverrides] = useState<Record<string, Partial<ScheduledDose>>>({});

  // Merge server data with local optimistic overrides
  const serverDoses = useMemo(() => query.data ?? [], [query.data]);
  const doses = useMemo(
    () => serverDoses.map((d) => (overrides[d.id] != null ? { ...d, ...overrides[d.id] } : d)),
    [serverDoses, overrides],
  );

  const { takenCount, totalCount } = useMemo(() => {
    let taken = 0;
    for (const d of doses) if (d.status === 'taken') taken++;
    return { takenCount: taken, totalCount: doses.length };
  }, [doses]);

  const markTaken = useCallback(
    async (doseId: string): Promise<void> => {
      // Apply optimistic override immediately (sync React state update)
      setOverrides((prev) => ({ ...prev, [doseId]: { status: 'taken', taken_via: 'manual' } }));
      try {
        const updated = await apiMarkTaken(doseId);
        // Reconcile with server response via query cache
        qc.setQueryData<ScheduledDose[]>(
          DOSES_TODAY_QUERY_KEY,
          (old) => old?.map((d) => (d.id === doseId ? updated : d)) ?? [],
        );
        // Remove override now that cache is updated
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[doseId];
          return next;
        });
      } catch (err) {
        // Roll back optimistic override on error
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[doseId];
          return next;
        });
        throw err;
      }
    },
    [qc],
  );

  const markSkipped = useCallback(
    async (doseId: string): Promise<void> => {
      setOverrides((prev) => ({ ...prev, [doseId]: { status: 'skipped' } }));
      try {
        const updated = await apiMarkSkipped(doseId);
        qc.setQueryData<ScheduledDose[]>(
          DOSES_TODAY_QUERY_KEY,
          (old) => old?.map((d) => (d.id === doseId ? updated : d)) ?? [],
        );
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[doseId];
          return next;
        });
      } catch (err) {
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[doseId];
          return next;
        });
        throw err;
      }
    },
    [qc],
  );

  return {
    doses,
    takenCount,
    totalCount,
    isLoading: query.isLoading,
    error: query.error,
    markTaken,
    markSkipped,
  };
}
