/**
 * Infraestrutura comum dos handlers: respostas de erro tipadas, injeção de
 * latência/falhas configuráveis e resolução de sessão/carrinho a partir do
 * request — tudo na camada de rede.
 */
import { delay, http, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { mulberry32 } from './fixtures'
import { loadConfig, saveConfig, type FailureRule, type MockConfig } from './config'
import { db, findSession, findUser, type SessionRecord } from './db'
import type { CartRecord, UserRecord } from './fixtures'

export const API = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
export const CLIENT_TIMEOUT_MS = Number(import.meta.env.VITE_HTTP_TIMEOUT_MS ?? 8000)

/* ------------------------------------------------------------------ */
/* Configuração viva                                                    */
/* ------------------------------------------------------------------ */

let config: MockConfig = loadConfig()
let latencyRand = mulberry32(config.latency.mode === 'variable' ? config.latency.seed : 1)
let catalogCalls = 0

export const mockConfig = {
  get: () => config,
  set(next: MockConfig) {
    config = next
    latencyRand = mulberry32(next.latency.mode === 'variable' ? next.latency.seed : 1)
    catalogCalls = 0
    saveConfig(next)
  },
  consumeRule(rule: FailureRule) {
    if (rule.times === undefined) return
    rule.times -= 1
    if (rule.times <= 0) config.rules = config.rules.filter((r) => r.id !== rule.id)
    saveConfig(config)
  },
}

/* ------------------------------------------------------------------ */
/* Respostas                                                            */
/* ------------------------------------------------------------------ */

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown; retryable?: boolean } = {},
) {
  const body: ApiErrorBody = { error: { code, message, ...extra } }
  return HttpResponse.json(body, { status })
}

export function validationError(fieldErrors: Record<string, string>, message = 'Revise os campos destacados.') {
  return apiError(422, 'VALIDATION_ERROR', message, { fieldErrors })
}

/** Lança uma resposta (MSW interrompe o resolver e a devolve). */
export function fail(status: number, code: ApiErrorCode, message: string, extra?: Parameters<typeof apiError>[3]): never {
  throw apiError(status, code, message, extra)
}

/* ------------------------------------------------------------------ */
/* Condições de rede                                                    */
/* ------------------------------------------------------------------ */

function matchPath(pattern: string, path: string) {
  const regex = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+') + '$')
  return regex.test(path)
}

function latencyFor(method: string, path: string): number {
  if (config.outOfOrderCatalog && method === 'GET' && path === '/nfts') {
    // 1ª chamada lenta, 2ª rápida, 3ª lenta...: a resposta antiga chega depois da nova
    const ms = catalogCalls % 2 === 0 ? 1600 : 150
    catalogCalls += 1
    return ms
  }
  const l = config.latency
  if (l.mode === 'none') return 0
  if (l.mode === 'fixed') return l.ms
  return Math.round(l.minMs + latencyRand() * (l.maxMs - l.minMs))
}

async function applyConditions(request: Request, path: string): Promise<Response | null> {
  const method = request.method.toUpperCase()
  if (config.offline) {
    await delay(150)
    return HttpResponse.error()
  }
  const ms = latencyFor(method, path)
  if (ms > 0) await delay(ms)
  const rule = config.rules.find((r) => (!r.method || r.method === method) && matchPath(r.path, path))
  if (!rule) return null
  mockConfig.consumeRule(rule)
  switch (rule.effect.type) {
    case 'network-error':
      return HttpResponse.error()
    case 'timeout':
      await delay(CLIENT_TIMEOUT_MS + 2000)
      return apiError(504, 'TRANSIENT', 'Tempo de resposta excedido.', { retryable: true })
    case 'delay':
      await delay(rule.effect.ms)
      return null
    case 'status':
      return apiError(rule.effect.status, rule.effect.code as ApiErrorCode, rule.effect.message, {
        retryable: rule.effect.status >= 500,
      })
  }
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/**
 * Registra uma rota da API aplicando, antes do resolver, latência e falhas
 * do cenário ativo. `path` é relativo à base da API (ex.: "/nfts/:id").
 */
export function route<Params extends PathParams>(
  method: Method,
  path: string,
  resolver: HttpResponseResolver<Params, DefaultBodyType, DefaultBodyType>,
) {
  return http[method]<Params>(`${API}${path}`, async (info) => {
    const actualPath = new URL(info.request.url).pathname.slice(API.length) || '/'
    const injected = await applyConditions(info.request, actualPath)
    if (injected) return injected
    try {
      return await resolver(info)
    } catch (thrown) {
      if (thrown instanceof Response) return thrown
      console.error('[mock] erro inesperado em', method.toUpperCase(), path, thrown)
      return apiError(500, 'INTERNAL', 'Erro interno no servidor simulado.', { retryable: true })
    }
  })
}

export async function readBody<T>(request: Request): Promise<Partial<T>> {
  try {
    const body = (await request.json()) as unknown
    return typeof body === 'object' && body !== null ? (body as Partial<T>) : {}
  } catch {
    return {}
  }
}

/* ------------------------------------------------------------------ */
/* Sessão                                                               */
/* ------------------------------------------------------------------ */

export function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

export function sessionIsValid(session: SessionRecord | undefined): session is SessionRecord {
  return !!session && !session.revoked && Date.parse(session.expiresAt) > Date.now()
}

/** Usuário autenticado ou lança 401 (UNAUTHENTICATED / SESSION_EXPIRED). */
export function requireUser(request: Request): { user: UserRecord; session: SessionRecord } {
  const token = bearer(request)
  if (!token) fail(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  const session = findSession(token)
  if (!session) fail(401, 'SESSION_EXPIRED', 'Sua sessão não é mais válida. Entre novamente.')
  if (!sessionIsValid(session)) fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  const user = findUser(session.userId)
  if (!user) fail(401, 'SESSION_EXPIRED', 'Sua sessão não é mais válida. Entre novamente.')
  return { user, session }
}

/** Usuário opcional: sem token = visitante; token inválido = 401 SESSION_EXPIRED. */
export function optionalUser(request: Request): UserRecord | null {
  const token = bearer(request)
  if (!token) return null
  return requireUser(request).user
}

const GUEST_ID = /^guest_[a-zA-Z0-9-]{8,64}$/

/** Carrinho do usuário autenticado ou do visitante (X-Cart-Id). */
export function resolveCart(request: Request): CartRecord {
  const user = optionalUser(request)
  const now = new Date().toISOString()
  if (user) {
    const id = `user:${user.id}`
    const carts = db.state.carts
    if (!carts[id]) carts[id] = { id, owner: 'user', userId: user.id, lines: [], couponCode: null, version: 1, updatedAt: now }
    return carts[id]
  }
  const guestId = request.headers.get('X-Cart-Id')
  if (!guestId || !GUEST_ID.test(guestId)) fail(400, 'VALIDATION_ERROR', 'Identificador de carrinho ausente ou inválido.')
  const id = `guest:${guestId}`
  const carts = db.state.carts
  if (!carts[id]) carts[id] = { id, owner: 'guest', userId: null, lines: [], couponCode: null, version: 1, updatedAt: now }
  return carts[id]
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomToken(prefix: string) {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}
