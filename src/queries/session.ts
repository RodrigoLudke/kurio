import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/api/contracts'
import { authApi, cartApi } from '@/api/endpoints'
import { sessionStore } from '@/api/session-store'
import { keys } from './keys'

export function useSessionState() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState)
}

/** Identificador do dono do carrinho atual (usuário ou visitante). */
export function useCartOwner() {
  const { session, guestCartId } = useSessionState()
  return session ? `user:${session.userId}` : `guest:${guestCartId}`
}

/**
 * Usuário autenticado. A sessão é recuperada após refresh a partir do token
 * salvo e validada no servidor (GET /auth/session).
 */
export function useCurrentUser() {
  const { session } = useSessionState()
  const query = useQuery({
    queryKey: keys.session(session?.token ?? null),
    queryFn: ({ signal }) => authApi.session({ signal }),
    enabled: !!session,
    staleTime: 60_000,
    select: (data) => data.user,
  })
  const user: User | null = session ? (query.data ?? null) : null
  return {
    user,
    userId: session?.userId ?? null,
    isAuthenticated: !!session,
    isLoading: !!session && query.isPending,
    error: query.error,
  }
}

/** Abre a sessão no cliente e mescla o carrinho do visitante na conta. */
async function establish(response: AuthResponse, queryClient: ReturnType<typeof useQueryClient>) {
  const guestCartId = sessionStore.getState().guestCartId
  sessionStore.setSession({ token: response.session.token, userId: response.user.id, expiresAt: response.session.expiresAt })
  queryClient.setQueryData(keys.session(response.session.token), { user: response.user, session: { expiresAt: response.session.expiresAt } })
  try {
    const merged = await cartApi.merge({ guestCartId })
    queryClient.setQueryData(keys.cart(`user:${response.user.id}`), merged)
  } catch {
    // a mescla é reexecutável; se falhar, o carrinho da conta é recarregado normalmente
    void queryClient.invalidateQueries({ queryKey: keys.cartAll() })
  }
  queryClient.removeQueries({ queryKey: keys.cart(`guest:${guestCartId}`) })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (response) => establish(response, queryClient),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (response) => establish(response, queryClient),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } finally {
        // mesmo sem resposta do servidor, a sessão local é encerrada
        sessionStore.clearSession('logout')
      }
    },
  })
}
