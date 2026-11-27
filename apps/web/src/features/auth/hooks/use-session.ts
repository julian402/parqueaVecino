'use client';

import type { AuthUser } from '@parqueavecino/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  getAuthSessionQueryKey,
  useAuthLogout,
  useAuthSession,
} from '@/lib/api/generated/auth/auth';

/**
 * Sesión actual. Usa `/auth/session`, que responde 200 con `user: null` a los visitantes
 * (sin 401 en consola) y renueva la sesión si el access token venció.
 */
export function useSession() {
  const query = useAuthSession({ query: { staleTime: 60_000 } });
  const user = query.data?.user ?? null;
  return {
    user,
    isLoading: query.isLoading,
    isAnonymous: query.isSuccess && !user,
  };
}

/** Guarda el usuario en caché tras login/registro, sin pedir /auth/me otra vez. */
export function useSetSessionUser() {
  const queryClient = useQueryClient();
  return (user: AuthUser) => queryClient.setQueryData(getAuthSessionQueryKey(), { user });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const logout = useAuthLogout();
  return async () => {
    await logout.mutateAsync();
    queryClient.clear();
  };
}
