/**
 * Configuração do servidor simulado: cenário ativo, condições de rede,
 * regras de falha e comportamento de pagamento. Persistida em localStorage
 * para sobreviver a refresh; `reset` restaura o cenário padrão.
 */
import { readJson, writeJson } from '@/lib/storage'

export type LatencyConfig =
  | { mode: 'none' }
  | { mode: 'fixed'; ms: number }
  | { mode: 'variable'; minMs: number; maxMs: number; seed: number }

export type FailureEffect =
  | { type: 'status'; status: number; code: string; message: string }
  | { type: 'network-error' }
  | { type: 'timeout' }
  | { type: 'delay'; ms: number }

export interface FailureRule {
  id: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** caminho relativo à API, aceita * como curinga: "/favorites/*" */
  path: string
  effect: FailureEffect
  /** quantas vezes aplicar; omitido = sempre */
  times?: number
  label: string
}

export type PaymentOutcome = 'confirmed' | 'declined'

export interface MockConfig {
  scenario: ScenarioId
  latency: LatencyConfig
  offline: boolean
  rules: FailureRule[]
  payment: { mode: 'auto'; outcome: PaymentOutcome; delayMs: number } | { mode: 'manual' }
  /** latências decrescentes em GET /nfts para produzir respostas fora de ordem */
  outOfOrderCatalog: boolean
  emptyCatalog: boolean
  /** atrasa a primeira resposta de cada chave de idempotência além do timeout do cliente */
  orderTimeoutOnce: boolean
  /** após emitir a cotação, altera o preço (ou esgota) o primeiro item */
  checkoutMutation: 'none' | 'price' | 'sold-out'
  walletRejects: boolean
  /** duração da sessão em segundos */
  sessionTtlSeconds: number
}

export const SCENARIOS = {
  default: 'Padrão — sucesso, latência baixa',
  slow: 'Rede lenta — 2,5 s por requisição',
  'variable-latency': 'Latência variável (semente fixa)',
  'out-of-order': 'Respostas fora de ordem no catálogo',
  offline: 'Sem conexão com o servidor',
  'server-error': 'Erro 500 no catálogo e no detalhe',
  'empty-catalog': 'Catálogo vazio',
  'favorites-failure': 'Falha ao salvar favoritos (HTTP 500)',
  'short-session': 'Sessão expira em 45 s',
  'price-change-checkout': 'Preço muda após a cotação',
  'sold-out-checkout': 'Edição esgota após a cotação',
  'order-timeout': 'Timeout após criar o pedido',
  'payment-declined': 'Pagamento recusado',
  'payment-manual': 'Pagamento pendente até confirmação manual',
  'wallet-reject': 'Carteira recusa a conexão',
} as const

export type ScenarioId = keyof typeof SCENARIOS

const BASE: Omit<MockConfig, 'scenario'> = {
  latency: { mode: 'variable', minMs: 60, maxMs: 220, seed: 7 },
  offline: false,
  rules: [],
  payment: { mode: 'auto', outcome: 'confirmed', delayMs: 2500 },
  outOfOrderCatalog: false,
  emptyCatalog: false,
  orderTimeoutOnce: false,
  checkoutMutation: 'none',
  walletRejects: false,
  sessionTtlSeconds: 60 * 60,
}

export function scenarioConfig(id: ScenarioId): MockConfig {
  const config: MockConfig = { ...structuredClone(BASE), scenario: id }
  switch (id) {
    case 'default':
      break
    case 'slow':
      config.latency = { mode: 'fixed', ms: 2500 }
      break
    case 'variable-latency':
      config.latency = { mode: 'variable', minMs: 200, maxMs: 2200, seed: 42 }
      break
    case 'out-of-order':
      config.outOfOrderCatalog = true
      break
    case 'offline':
      config.offline = true
      break
    case 'server-error':
      config.rules = [
        { id: 'catalog-500', method: 'GET', path: '/nfts', effect: { type: 'status', status: 500, code: 'INTERNAL', message: 'Falha interna ao consultar o catálogo.' }, label: 'GET /nfts → 500' },
        { id: 'detail-503', method: 'GET', path: '/nfts/*', effect: { type: 'status', status: 503, code: 'TRANSIENT', message: 'Serviço temporariamente indisponível.' }, label: 'GET /nfts/:id → 503' },
      ]
      break
    case 'empty-catalog':
      config.emptyCatalog = true
      break
    case 'favorites-failure':
      config.rules = [
        { id: 'fav-put', method: 'PUT', path: '/favorites/*', effect: { type: 'status', status: 500, code: 'INTERNAL', message: 'Não foi possível salvar o favorito.' }, label: 'PUT /favorites → 500' },
        { id: 'fav-del', method: 'DELETE', path: '/favorites/*', effect: { type: 'status', status: 500, code: 'INTERNAL', message: 'Não foi possível remover o favorito.' }, label: 'DELETE /favorites → 500' },
      ]
      break
    case 'short-session':
      config.sessionTtlSeconds = 45
      break
    case 'price-change-checkout':
      config.checkoutMutation = 'price'
      break
    case 'sold-out-checkout':
      config.checkoutMutation = 'sold-out'
      break
    case 'order-timeout':
      config.orderTimeoutOnce = true
      break
    case 'payment-declined':
      config.payment = { mode: 'auto', outcome: 'declined', delayMs: 2000 }
      break
    case 'payment-manual':
      config.payment = { mode: 'manual' }
      break
    case 'wallet-reject':
      config.walletRejects = true
      break
  }
  return config
}

const CONFIG_KEY = 'kurio.mock.config.v1'

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && value in SCENARIOS
}

export function loadConfig(): MockConfig {
  const stored = readJson<MockConfig>(CONFIG_KEY)
  if (stored && isScenarioId(stored.scenario)) return { ...scenarioConfig(stored.scenario), ...stored }
  return scenarioConfig('default')
}

export function saveConfig(config: MockConfig) {
  writeJson(CONFIG_KEY, config)
}

export function clearConfig() {
  writeJson(CONFIG_KEY, null)
}
