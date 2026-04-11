import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from './api';
import type { ProfileRow, ProfileUpdate } from './api';

export const profileQueryKey = ['profile', 'me'] as const;

export function useProfile() {
  return useQuery<ProfileRow | null>({
    queryKey: profileQueryKey,
    queryFn: getProfile,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partial: ProfileUpdate) => updateProfile(partial),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}
