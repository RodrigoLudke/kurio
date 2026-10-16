import { expect, test as base, type Page, type TestInfo } from '@playwright/test'

export const ANA = { email: 'ana@kurio.dev', password: 'Kurio@2026', name: 'Ana Ribeiro', id: 'usr_ana' }
export const BRUNO = { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno Costa', id: 'usr_bruno' }

export function isMobile(testInfo: TestInfo) {
  return testInfo.project.name.startsWith('mobile')
}

/**
 * Abre uma rota com o servidor simulado num estado conhecido. Cada teste
 * roda num contexto novo (storage vazio), então o banco simulado nasce das
 * fixtures; `scenario` seleciona um cenário determinístico.
 */
export async function open(page: Page, path: string, options: { scenario?: string } = {}) {
  const url = new URL(path, 'http://x')
  url.searchParams.set('mock-reset', '1')
  if (options.scenario) url.searchParams.set('mock-scenario', options.scenario)
  await page.goto(url.pathname + url.search)
  await waitForMocks(page)
}

export async function waitForMocks(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __kurioWorker?: unknown }).__kurioWorker)
}

/** Chama o plano de controle do servidor simulado (passa pelos handlers MSW). */
export async function mock<T = unknown>(page: Page, path: string, body?: unknown): Promise<T> {
  await waitForMocks(page)
  return page.evaluate(
    async ([p, b]) => {
      const res = await fetch(`/api/__mock${p}`, {
        method: b === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: b === undefined ? undefined : JSON.stringify(b),
      })
      return res.json()
    },
    [path, body] as const,
  ) as Promise<T>
}

/** Requisição REST autenticada com a sessão atual do navegador. */
export async function api<T = unknown>(page: Page, method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  await waitForMocks(page)
  return page.evaluate(
    async ([m, p, b]) => {
      const session = JSON.parse(localStorage.getItem('kurio.session.v1') ?? 'null') as { token: string } | null
      const cart = JSON.parse(localStorage.getItem('kurio.guest-cart.v1') ?? 'null') as string | null
      const res = await fetch(`/api${p}`, {
        method: m,
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
          ...(cart ? { 'X-Cart-Id': cart } : {}),
        },
        body: b === undefined ? undefined : JSON.stringify(b),
      })
      const text = await res.text()
      return { status: res.status, data: text ? JSON.parse(text) : null }
    },
    [method, path, body] as const,
  ) as Promise<{ status: number; data: T }>
}

/** Login pela interface (modal no desktop, tela cheia no mobile). */
export async function loginUI(page: Page, user = ANA, redirect = '/') {
  await page.goto(`/entrar?redirect=${encodeURIComponent(redirect)}`)
  await waitForMocks(page)
  await page.getByPlaceholder('contato@email.com').fill(user.email)
  await page.locator('#login-password').fill(user.password)
  await page.getByTestId('auth-submit').click()
  await page.waitForURL((url) => url.pathname === redirect.split('?')[0])
}

/** Aguarda o catálogo estabilizar (sem atualização em segundo plano). */
export async function settledGrid(page: Page) {
  const grid = page.getByTestId('catalog-grid')
  await expect(grid).toHaveAttribute('aria-busy', 'false')
  return grid
}

export async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  await waitForMocks(page)
}

export const test = base

export { expect }
