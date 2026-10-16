/**
 * Ciclo de vida da sessão fora da árvore React:
 * - abre/reabre o socket com o token atual (troca de usuário = novo socket);
 * - ao encerrar a sessão (logout, expiração, troca), remove do cache todos os
 *   dados privados do usuário anterior;
 * - na expiração, informa e leva ao login preservando a rota atual.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'
import { authApi } from '@/api/endpoints'
import { sessionStore } from '@/api/session-store'
import { announce } from '@/lib/announce'
import { keys } from '@/queries/keys'
import { realtime } from '@/realtime/client'

export function installSessionLifecycle(queryClient: QueryClient, router: AnyRouter) {
  let currentToken: string | null | undefined
  const syncSocket = () => {
    const session = sessionStore.getState().session
    const token = session?.token ?? null
    if (token === currentToken) return
    currentToken = token
    void realtime.connect(token, session?.userId ?? null)
  }
  syncSocket()
  sessionStore.subscribe(syncSocket)

  // ao atingir o prazo da sessão, revalida no servidor (401 encerra a sessão
  // pelo interceptor do Axios; se o servidor a renovou, nada acontece)
  let expiryTimer: number | undefined
  const scheduleExpiryCheck = () => {
    window.clearTimeout(expiryTimer)
    const session = sessionStore.getState().session
    if (!session) return
    const delay = Math.max(0, Date.parse(session.expiresAt) - Date.now()) + 500
    expiryTimer = window.setTimeout(() => {
      authApi.session().catch(() => undefined)
    }, Math.min(delay, 2_147_000_000))
  }
  scheduleExpiryCheck()
  sessionStore.subscribe(scheduleExpiryCheck)

  sessionStore.onSessionEnd((reason, previous) => {
    queryClient.cancelQueries({ queryKey: keys.privateAll(previous.userId) })
    queryClient.removeQueries({ queryKey: keys.privateAll(previous.userId) })
    queryClient.removeQueries({ queryKey: keys.cart(`user:${previous.userId}`) })
    queryClient.removeQueries({ queryKey: ['session'] })
    queryClient.getMutationCache().clear()

    if (reason !== 'expired') return
    announce('Sua sessão expirou. Entre novamente para continuar de onde parou.', { tone: 'warning', toast: true })
    const state = router.state
    const isPrivate = state.matches.some((m) => m.staticData?.private)
    if (isPrivate) {
      void router.navigate({ to: '/entrar', search: { redirect: state.location.href, motivo: 'expirada' }, replace: true })
    }
  })
}
