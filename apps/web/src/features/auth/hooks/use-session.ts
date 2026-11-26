'use client';

import type { AuthUser } from '@parqueavecino/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthMeQueryKey, useAuthLogout, useAuthMe } from '@/lib/api/generated/auth/auth';
import { HttpError } from '@/lib/api/http';

/** Sesión actual. `user` es null si no hay sesión (401), sin tratarlo como error. */
export function useSession() {
  const query = useAuthMe({ query: { staleTime: 60_000 } });
  const isAnonymous = query.error instanceof HttpError && query.error.status === 401;
  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAnonymous,
  };
}

/** Guarda el usuario en caché tras login/registro, sin pedir /auth/me otra vez. */
export function useSetSessionUser() {
  const queryClient = useQueryClient();
  return (user: AuthUser) => queryClient.setQueryData(getAuthMeQueryKey(), user);
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const logout = useAuthLogout();
  return async () => {
    await logout.mutateAsync();
    queryClient.clear();
  };
}
