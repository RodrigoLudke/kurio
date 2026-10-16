import axios, { type AxiosRequestConfig } from 'axios'
import { toAppError } from './errors'
import { sessionStore } from './session-store'

/**
 * Portão de transporte: com mocks ativos, as requisições aguardam o Service
 * Worker do MSW assumir o controle antes de sair. Sem mocks, resolve
 * imediatamente. Não altera respostas nem cria caminhos de negócio.
 */
let resolveTransport: () => void = () => {}
const transportReady = new Promise<void>((resolve) => {
  resolveTransport = resolve
})
export function markTransportReady() {
  resolveTransport()
}
export function whenTransportReady() {
  return transportReady
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const TIMEOUT_MS = Number(import.meta.env.VITE_HTTP_TIMEOUT_MS ?? 8000)

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use(async (config) => {
  await transportReady
  const { session, guestCartId } = sessionStore.getState()
  if (session) config.headers.set('Authorization', `Bearer ${session.token}`)
  config.headers.set('X-Cart-Id', guestCartId)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const appError = toAppError(error)
    const authHeader = error?.config?.headers?.get?.('Authorization') ?? error?.config?.headers?.Authorization
    const sentToken = String(authHeader ?? '').replace('Bearer ', '')
    const current = sessionStore.getState().session
    // só derruba a sessão se o 401 se refere ao token atual (evita corrida com troca de usuário)
    if (
      appError.status === 401 &&
      (appError.code === 'SESSION_EXPIRED' || appError.code === 'UNAUTHENTICATED') &&
      current &&
      sentToken === current.token
    ) {
      sessionStore.clearSession('expired')
    }
    return Promise.reject(appError)
  },
)

/** Helpers tipados: retornam `data` e propagam AbortSignal do TanStack Query. */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await http.get<T>(url, config)
  return res.data
}
export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await http.post<T>(url, body, config)
  return res.data
}
export async function put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await http.put<T>(url, body, config)
  return res.data
}
export async function patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await http.patch<T>(url, body, config)
  return res.data
}
export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await http.delete<T>(url, config)
  return res.data
}
