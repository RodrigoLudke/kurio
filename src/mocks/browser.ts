import { http } from 'msw'
import { setupWorker } from 'msw/browser'
import { consumeMockBootParams } from './boot'
import { clearConfig, isScenarioId, scenarioConfig } from './config'
import { resetDb } from './db'
import { processDueOrders } from './domain'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { controlHandlers } from './handlers/control'
import { orderHandlers } from './handlers/orders'
import { realtimeHandlers } from './realtime'
import { API, apiError, mockConfig } from './runtime'

export const handlers = [
  ...controlHandlers,
  ...catalogHandlers,
  ...authHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  ...realtimeHandlers,
  // qualquer outra rota da API responde 404 tipado
  http.all(`${API}/*`, () => apiError(404, 'NOT_FOUND', 'Recurso inexistente.')),
]

function applyBootParams() {
  const params = consumeMockBootParams()
  if (!params) return
  if (params.reset) {
    resetDb()
    clearConfig()
    mockConfig.set(scenarioConfig('default'))
  }
  if (isScenarioId(params.scenario)) mockConfig.set(scenarioConfig(params.scenario))
}

export async function startMockServer() {
  applyBootParams()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  ;(window as unknown as { __kurioWorker?: unknown }).__kurioWorker = worker
  // liquida pagamentos simulados no prazo (também ocorre a cada request)
  window.setInterval(processDueOrders, 500)
  processDueOrders()
  return worker
}
