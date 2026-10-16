/**
 * Painel de simulação (somente com mocks ativos).
 *
 * Ferramenta de demonstração/avaliação: troca cenários e condições de rede e
 * provoca mudanças NO SERVIDOR simulado (`/api/__mock/*`). As consequências
 * chegam à interface pelos mesmos caminhos de produção — respostas REST e
 * eventos Socket.IO. O painel nunca altera cache ou estado da UI diretamente,
 * exceto para pedir um refetch após trocar de cenário.
 */
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { whenTransportReady } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { addEth } from '@/lib/eth'
import { safeLocalStorage, safeSessionStorage } from '@/lib/storage'

const API = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

interface MockState {
  config: { scenario: string; offline: boolean; latency: { mode: string; ms?: number; minMs?: number; maxMs?: number } }
  scenarios: Record<string, string>
  realtime: { connections: number; authenticated: number; downUntil: string | null }
  pendingOrders: { id: string; userId: string; number: string }[]
  connections: { walletId: string; userId: string; provider: string; network: string }[]
  recentEvents: { eventId: string; type: string; resource: { id: string }; version: number }[]
  nfts: { id: string; name: string; price: string; version: number }[]
}

async function call<T = MockState>(path: string, body?: unknown): Promise<T> {
  await whenTransportReady()
  const res = await fetch(`${API}/__mock${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return (await res.json()) as T
}

const LATENCIES = {
  default: { label: 'Padrão (60–220 ms)', value: { mode: 'variable', minMs: 60, maxMs: 220, seed: 7 } },
  none: { label: 'Sem atraso', value: { mode: 'none' } },
  slow: { label: 'Lenta (2,5 s)', value: { mode: 'fixed', ms: 2500 } },
  variable: { label: 'Variável (0,2–2,2 s)', value: { mode: 'variable', minMs: 200, maxMs: 2200, seed: 42 } },
} as const

export default function MockPanel() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MockState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [nftId, setNftId] = useState('emerald-ape-042')
  const [log, setLog] = useState<string>('')

  const refresh = useCallback(async () => setState(await call('/state')), [])
  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const run = async (label: string, fn: () => Promise<unknown>, refetchAll = false) => {
    setBusy(label)
    try {
      await fn()
      setLog(`✓ ${label}`)
      if (refetchAll) await queryClient.invalidateQueries()
      await refresh()
    } catch (e) {
      setLog(`✗ ${label}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const reset = async () => {
    setBusy('reset')
    await call('/reset', {})
    // limpa a sessão do navegador para que o cenário conhecido seja restaurado integralmente
    const local = safeLocalStorage()
    if (local) Object.keys(local).filter((k) => k.startsWith('kurio.') && !k.startsWith('kurio.mock')).forEach((k) => local.removeItem(k))
    safeSessionStorage()?.clear()
    window.location.assign('/')
  }

  const nft = state?.nfts.find((n) => n.id === nftId)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-2 text-xs font-bold text-orange shadow-lg hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring max-md:top-1/3 max-md:bottom-auto max-md:left-0 max-md:rounded-l-none max-md:px-2"
        data-testid="mock-panel-toggle"
        aria-label="Abrir painel de simulação"
      >
        <FlaskConical className="size-4" aria-hidden="true" />
        <span className="max-md:hidden">Simulação</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[92%] max-w-md gap-5 p-5 text-sm">
          <SheetHeader className="p-0 pr-8">
            <SheetTitle>Painel de simulação</SheetTitle>
            <SheetDescription>
              Controla o servidor simulado (MSW + Socket.IO). As mudanças chegam à interface por REST e eventos em tempo real.
            </SheetDescription>
          </SheetHeader>

          {!state ? (
            <Loader2 className="size-5 animate-spin text-orange" aria-label="Carregando" />
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="font-bold text-orange">Cenário</h3>
                <Label htmlFor="mock-scenario" className="sr-only">
                  Cenário
                </Label>
                <Select value={state.config.scenario} onValueChange={(id) => void run(`cenário ${id}`, () => call('/scenario', { id }), true)}>
                  <SelectTrigger id="mock-scenario">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(state.scenarios).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => void reset()} disabled={!!busy}>
                  Restaurar dados e cenário padrão
                </Button>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="font-bold text-orange">Rede</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(LATENCIES).map(([key, l]) => (
                    <Button key={key} size="sm" variant="secondary" onClick={() => void run(`latência ${l.label}`, () => call('/network', { latency: l.value }))}>
                      {l.label}
                    </Button>
                  ))}
                  <Button size="sm" variant={state.config.offline ? 'default' : 'secondary'} onClick={() => void run('offline', () => call('/network', { offline: !state.config.offline }), !state.config.offline ? false : true)}>
                    {state.config.offline ? 'Voltar a ficar online' : 'Ficar offline'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void run('próximo GET /nfts → 500', () => call('/failures', { id: 'once-500', method: 'GET', path: '/nfts', times: 1, effect: { type: 'status', status: 500, code: 'INTERNAL', message: 'Falha simulada.' } }))}
                  >
                    Próximo catálogo → 500
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void run('regras de falha removidas', () => fetch(`${API}/__mock/failures`, { method: 'DELETE' }))}>
                    Limpar falhas
                  </Button>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="font-bold text-orange">Tempo real (Socket.IO)</h3>
                <p className="text-xs text-sand">
                  Conexões: {state.realtime.connections} ({state.realtime.authenticated} autenticadas){state.realtime.downUntil ? ' · servidor fora do ar' : ''}
                </p>
                <Select value={nftId} onValueChange={setNftId}>
                  <SelectTrigger aria-label="NFT alvo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.nfts.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name} · {n.price} ETH · v{n.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={!nft} onClick={() => nft && void run('preço +0.10', () => call(`/nfts/${nft.id}`, { price: addEth(nft.price, '0.1') }))}>
                    Preço +0,10 ETH
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void run('edição padrão esgotada', () => call(`/nfts/${nftId}`, { available: 0 }))}>
                    Esgotar edição 1/50
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void run('estoque 3', () => call(`/nfts/${nftId}`, { available: 3 }))}>
                    Estoque → 3
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void run('duplicata enviada', () => call('/realtime/replay', { mode: 'duplicate' }))}>
                    Reenviar último evento
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void run('evento antigo enviado', () => call('/realtime/replay', { mode: 'stale', type: 'nft.updated' }))}>
                    Enviar evento antigo
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void run('conexão derrubada', () => call('/realtime/disconnect', { downMs: 5000 }))}>
                    Derrubar conexão (5 s)
                  </Button>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="font-bold text-orange">Sessão, pedidos e carteiras</h3>
                <Button size="sm" variant="secondary" onClick={() => void run('sessões expiradas', () => call('/sessions/expire', {}))}>
                  Expirar sessão agora
                </Button>
                {state.pendingOrders.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs">Pendente: {o.number}</span>
                    <Button size="sm" onClick={() => void run(`${o.number} confirmado`, () => call(`/orders/${o.id}/resolve`, { outcome: 'confirmed' }))}>
                      Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void run(`${o.number} recusado`, () => call(`/orders/${o.id}/resolve`, { outcome: 'declined' }))}>
                      Recusar
                    </Button>
                  </div>
                ))}
                {state.connections.map((c) => (
                  <div key={c.walletId} className="flex items-center gap-2">
                    <span className="text-xs">
                      Conectada: {c.provider} · {c.network}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => void run('carteira desconectada', () => call(`/wallets/${c.walletId}/disconnect`, {}))}>
                      Desconectar
                    </Button>
                  </div>
                ))}
              </section>

              <section className="flex flex-col gap-1 text-xs text-sand">
                <h3 className="text-sm font-bold text-orange">Contas de demonstração</h3>
                <p>ana@kurio.dev · bruno@kurio.dev — senha Kurio@2026</p>
                <p>Cupons: KURIO10 (10%), LANCAMENTO (0,05 ETH), GENESIS24 (expirado)</p>
              </section>

              <p role="status" aria-live="polite" className="min-h-5 text-xs">
                {busy ? `Executando: ${busy}…` : log}
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
