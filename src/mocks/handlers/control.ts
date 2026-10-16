/**
 * Plano de controle do servidor simulado (`/api/__mock/*`).
 *
 * Usado pelo painel de simulação e pelos testes Playwright para trocar de
 * cenário, controlar a rede e disparar mudanças "no servidor". Toda mudança
 * de dados passa pelo banco simulado e chega ao cliente pelo mesmo caminho de
 * produção: respostas REST e eventos Socket.IO. Nenhuma rota de controle
 * escreve no estado da interface.
 */
import { http, HttpResponse } from 'msw'
import type { EditionType, RealtimeEvent } from '@/api/contracts'
import { isEthString } from '@/lib/eth'
import { clearConfig, isScenarioId, scenarioConfig, SCENARIOS, type FailureRule, type LatencyConfig, type MockConfig } from '../config'
import { db, findNft, resetDb } from '../db'
import { editionOf, priceOf, resolveOrder } from '../domain'
import { updateNft } from '../domain'
import { dropConnections, realtimeStats, replayLast, sendStale } from '../realtime'
import { API, apiError, mockConfig, readBody } from '../runtime'
import { disconnectWallet } from './account'

const BASE = `${API}/__mock`

function state() {
  const config = mockConfig.get()
  return {
    config,
    scenarios: SCENARIOS,
    realtime: realtimeStats(),
    users: db.state.users.map((u) => ({ id: u.id, email: u.email, username: u.username })),
    pendingOrders: db.state.orders.filter((o) => o.order.status === 'pending').map((o) => ({ id: o.order.id, userId: o.order.userId, number: o.order.number })),
    connections: Object.values(db.state.connections).map((c) => ({ walletId: c.walletId, userId: c.userId, provider: c.provider, network: c.network })),
    recentEvents: db.state.eventLog.slice(-10).map((e: RealtimeEvent) => ({ eventId: e.eventId, type: e.type, resource: e.resource, version: e.version })),
    nfts: db.state.nfts.slice(0, 12).map((n) => ({ id: n.id, name: n.name, price: priceOf(n), version: n.version })),
  }
}

export const controlHandlers = [
  http.get(`${BASE}/state`, () => HttpResponse.json(state())),

  http.post(`${BASE}/reset`, async ({ request }) => {
    const body = await readBody<{ scenario?: string }>(request)
    resetDb()
    clearConfig()
    mockConfig.set(scenarioConfig(isScenarioId(body.scenario) ? body.scenario : 'default'))
    dropConnections(0)
    return HttpResponse.json(state())
  }),

  http.post(`${BASE}/scenario`, async ({ request }) => {
    const body = await readBody<{ id?: string }>(request)
    if (!isScenarioId(body.id)) return apiError(422, 'VALIDATION_ERROR', 'Cenário desconhecido.')
    mockConfig.set(scenarioConfig(body.id))
    db.mutate((s) => {
      s.checkoutMutationDone = false
    })
    return HttpResponse.json(state())
  }),

  http.post(`${BASE}/network`, async ({ request }) => {
    const body = await readBody<{ latency?: LatencyConfig; offline?: boolean }>(request)
    const next: MockConfig = { ...mockConfig.get() }
    if (body.latency) next.latency = body.latency
    if (typeof body.offline === 'boolean') next.offline = body.offline
    mockConfig.set(next)
    return HttpResponse.json(state())
  }),

  http.post(`${BASE}/config`, async ({ request }) => {
    const body = await readBody<Partial<MockConfig>>(request)
    mockConfig.set({ ...mockConfig.get(), ...body, scenario: mockConfig.get().scenario })
    return HttpResponse.json(state())
  }),

  http.post(`${BASE}/failures`, async ({ request }) => {
    const rule = (await readBody<FailureRule>(request)) as FailureRule
    if (!rule.path || !rule.effect) return apiError(422, 'VALIDATION_ERROR', 'Regra inválida.')
    const next = { ...mockConfig.get(), rules: [...mockConfig.get().rules.filter((r) => r.id !== rule.id), { ...rule, label: rule.label ?? rule.path }] }
    mockConfig.set(next)
    return HttpResponse.json(state())
  }),

  http.delete(`${BASE}/failures`, () => {
    mockConfig.set({ ...mockConfig.get(), rules: [] })
    return HttpResponse.json(state())
  }),

  /** Altera preço/disponibilidade de um NFT e emite `nft.updated`. */
  http.post(`${BASE}/nfts/:id`, async ({ params, request }) => {
    const nft = findNft(String(params.id))
    if (!nft) return apiError(404, 'NFT_NOT_FOUND', 'NFT inexistente.')
    const body = await readBody<{ edition?: EditionType; price?: string; available?: number }>(request)
    if (body.price !== undefined && !isEthString(body.price)) return apiError(422, 'VALIDATION_ERROR', 'Preço inválido.')
    const edition = body.edition ?? nft.defaultEdition
    if (!editionOf(nft, edition)) return apiError(422, 'VALIDATION_ERROR', 'Edição inválida.')
    const event = updateNft(nft, { edition, price: body.price, available: body.available })
    return HttpResponse.json({ event })
  }),

  http.post(`${BASE}/realtime/replay`, async ({ request }) => {
    const body = await readBody<{ mode?: 'duplicate' | 'stale'; type?: RealtimeEvent['type'] }>(request)
    const event = body.mode === 'stale' ? sendStale(body.type) : replayLast(body.type)
    return HttpResponse.json({ event })
  }),

  http.post(`${BASE}/realtime/disconnect`, async ({ request }) => {
    const body = await readBody<{ downMs?: number }>(request)
    dropConnections(Math.max(0, Number(body.downMs ?? 0)))
    return HttpResponse.json(state())
  }),

  http.post(`${BASE}/sessions/expire`, async ({ request }) => {
    const body = await readBody<{ userId?: string }>(request)
    db.mutate((s) => {
      for (const session of s.sessions) {
        if (!body.userId || session.userId === body.userId) session.expiresAt = new Date(Date.now() - 1000).toISOString()
      }
    })
    return HttpResponse.json(state())
  }),

  http.post(`${BASE}/orders/:id/resolve`, async ({ params, request }) => {
    const record = db.state.orders.find((o) => o.order.id === params.id)
    if (!record) return apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
    const body = await readBody<{ outcome?: 'confirmed' | 'declined' }>(request)
    resolveOrder(record, body.outcome === 'declined' ? 'declined' : 'confirmed')
    return HttpResponse.json({ order: record.order })
  }),

  http.post(`${BASE}/wallets/:id/disconnect`, ({ params }) => {
    const ok = disconnectWallet(String(params.id), 'disconnected')
    return HttpResponse.json({ ok })
  }),
]
