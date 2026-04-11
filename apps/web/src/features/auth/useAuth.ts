import { useContext } from 'react';
import type { AuthContextValue } from './AuthProvider';
import { AuthContext } from './AuthProvider';

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
