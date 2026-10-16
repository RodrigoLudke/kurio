/**
 * Credenciais da sessão no cliente.
 *
 * Guarda apenas o token opaco emitido pela API (nunca senha) e o id do
 * carrinho de visitante. É um store externo minimalista para ser lido tanto
 * pelo interceptor do Axios quanto por componentes via useSyncExternalStore.
 */
import { readJson, writeJson, randomId } from '@/lib/storage'

const SESSION_KEY = 'kurio.session.v1'
const GUEST_CART_KEY = 'kurio.guest-cart.v1'

export interface StoredSession {
  token: string
  userId: string
  expiresAt: string
}

export type SessionEndReason = 'logout' | 'expired' | 'switch'

interface State {
  session: StoredSession | null
  guestCartId: string
}

type Listener = () => void

function initialState(): State {
  let guestCartId = readJson<string>(GUEST_CART_KEY)
  if (!guestCartId) {
    guestCartId = randomId('guest')
    writeJson(GUEST_CART_KEY, guestCartId)
  }
  return { session: readJson<StoredSession>(SESSION_KEY), guestCartId }
}

let state: State = initialState()
const listeners = new Set<Listener>()
const endListeners = new Set<(reason: SessionEndReason, previous: StoredSession) => void>()

function emit() {
  listeners.forEach((l) => l())
}

export const sessionStore = {
  getState: (): State => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Disparado quando uma sessão termina (logout, expiração ou troca de usuário). */
  onSessionEnd(listener: (reason: SessionEndReason, previous: StoredSession) => void) {
    endListeners.add(listener)
    return () => endListeners.delete(listener)
  },
  setSession(session: StoredSession) {
    const previous = state.session
    if (previous && previous.userId !== session.userId) {
      endListeners.forEach((l) => l('switch', previous))
    }
    state = { ...state, session }
    writeJson(SESSION_KEY, session)
    emit()
  },
  clearSession(reason: SessionEndReason) {
    const previous = state.session
    if (!previous) return
    // o carrinho de visitante anterior foi mesclado na conta: começa outro vazio
    const guestCartId = randomId('guest')
    writeJson(GUEST_CART_KEY, guestCartId)
    writeJson(SESSION_KEY, null)
    state = { session: null, guestCartId }
    endListeners.forEach((l) => l(reason, previous))
    emit()
  },
  /** sincroniza alterações feitas em outra aba */
  reloadFromStorage() {
    const next = initialState()
    const previous = state.session
    if (previous?.token === next.session?.token && state.guestCartId === next.guestCartId) return
    state = next
    if (previous && previous.userId !== next.session?.userId) {
      endListeners.forEach((l) => l(next.session ? 'switch' : 'logout', previous))
    }
    emit()
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY || event.key === GUEST_CART_KEY) sessionStore.reloadFromStorage()
  })
}
