/**
 * Persistência local do checkout, sempre isolada por usuário:
 * - rascunho do formulário (retomada após expiração de sessão/refresh);
 * - tentativa de pedido em andamento (chave de idempotência + payload), que
 *   permite reenviar exatamente a mesma requisição após timeout, queda de
 *   conexão ou refresh — o servidor devolve o pedido já criado.
 */
import type { CreateOrderRequest } from '@/api/contracts'
import { readJson, safeLocalStorage, safeSessionStorage, writeJson } from '@/lib/storage'

export interface CheckoutAttempt {
  idempotencyKey: string
  body: CreateOrderRequest
  orderId: string | null
  createdAt: string
}

const draftKey = (userId: string) => `kurio.checkout.draft.${userId}`
const attemptKey = (userId: string) => `kurio.checkout.attempt.${userId}`

export function loadDraft<T>(userId: string): Partial<T> | null {
  return readJson<Partial<T>>(draftKey(userId), safeSessionStorage())
}

export function saveDraft(userId: string, draft: unknown) {
  writeJson(draftKey(userId), draft, safeSessionStorage())
}

export function clearDraft(userId: string) {
  writeJson(draftKey(userId), null, safeSessionStorage())
}

export function loadAttempt(userId: string): CheckoutAttempt | null {
  return readJson<CheckoutAttempt>(attemptKey(userId), safeLocalStorage())
}

export function saveAttempt(userId: string, attempt: CheckoutAttempt | null) {
  writeJson(attemptKey(userId), attempt, safeLocalStorage())
}
