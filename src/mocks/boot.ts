/**
 * Captura parâmetros de inicialização dos mocks antes de o roteador ler a URL:
 * `?mock-scenario=<id>` e `?mock-reset=1`. São removidos da barra de endereço
 * e entregues ao servidor simulado via sessionStorage.
 */
const KEY = 'kurio.mock.boot'

export interface MockBootParams {
  scenario: string | null
  reset: boolean
}

export function captureMockBootParams() {
  const url = new URL(window.location.href)
  const scenario = url.searchParams.get('mock-scenario')
  const reset = url.searchParams.get('mock-reset')
  if (!scenario && !reset) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ scenario, reset: !!reset } satisfies MockBootParams))
  } catch {
    /* sem sessionStorage: ignora */
  }
  url.searchParams.delete('mock-scenario')
  url.searchParams.delete('mock-reset')
  window.history.replaceState(window.history.state, '', url)
}

export function consumeMockBootParams(): MockBootParams | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return raw ? (JSON.parse(raw) as MockBootParams) : null
  } catch {
    return null
  }
}
