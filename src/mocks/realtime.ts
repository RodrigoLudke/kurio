/**
 * Servidor Socket.IO simulado sobre o interceptador de WebSocket do MSW
 * (`ws.link`) com `@mswjs/socket.io-binding`, que codifica/decodifica o
 * protocolo Engine.IO/Socket.IO. O cliente real (`socket.io-client`)
 * conecta, autentica, recebe heartbeats e reconecta normalmente.
 *
 * Limitações do binding (documentadas no ARCHITECTURE.md):
 * - só o namespace "/" e sem salas/broadcast nativos: o registro de conexões
 *   abaixo faz o roteamento por usuário;
 * - o handshake é sintetizado pelo binding (sid fixo); por isso o token de
 *   autenticação é lido do pacote CONNECT ("40{...}") enviado pelo cliente;
 * - o servidor precisa emitir pings ("2") manualmente para o cliente não
 *   encerrar a conexão por pingTimeout.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent, WalletUpdatedEvent } from '@/api/contracts'
import { db, findSession, persist } from './db'
import { sessionIsValid } from './runtime'

const REALTIME_URL = (import.meta.env.VITE_REALTIME_URL ?? 'wss://realtime.kurio.mock').replace(/\/$/, '')
const PING_INTERVAL_MS = 20_000

interface Peer {
  id: number
  userId: string | null
  token: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const peers = new Map<number, Peer>()
let peerSeq = 0
let downUntil = 0

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// o MSW remove o prefixo "/socket.io/" do caminho antes de comparar
const link = ws.link(new RegExp(`^${escapeRegex(REALTIME_URL)}(/socket\\.io)?(/|$)`))

function identify(token: string | null): string | null {
  if (!token) return null
  const session = findSession(token)
  return sessionIsValid(session) ? session.userId : null
}

export const realtimeHandlers = [
  link.addEventListener('connection', (connection) => {
    if (Date.now() < downUntil) {
      // servidor indisponível: recusa a conexão (o cliente tentará de novo com backoff)
      queueMicrotask(() => connection.client.close(4001, 'unavailable'))
      return
    }
    const io = toSocketIo(connection)
    const id = ++peerSeq
    const peer: Peer = {
      id,
      userId: null,
      token: null,
      emit: (event, payload) => io.client.emit(event, payload),
      close: () => connection.client.close(4000, 'server disconnect'),
    }
    peers.set(id, peer)

    connection.client.addEventListener('message', (event) => {
      const data = typeof event.data === 'string' ? event.data : ''
      // pacote CONNECT do Socket.IO com o payload de `auth`
      if (data.startsWith('40')) {
        try {
          const auth = JSON.parse(data.slice(2) || '{}') as { token?: string | null }
          peer.token = auth.token ?? null
          peer.userId = identify(peer.token)
        } catch {
          peer.userId = null
        }
        io.client.emit('session.ready', { userId: peer.userId, serverTime: new Date().toISOString() })
      }
    })

    const heartbeat = setInterval(() => {
      try {
        connection.client.send('2')
      } catch {
        clearInterval(heartbeat)
      }
    }, PING_INTERVAL_MS)

    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      peers.delete(id)
    })
  }),
]

/** Publica um evento. Eventos com `userId` só chegam às conexões daquele usuário. */
export function publish(event: RealtimeEvent, target: { userId?: string } = {}) {
  db.state.eventLog = [...db.state.eventLog.slice(-49), event]
  persist()
  deliver(event, target)
}

function deliver(event: RealtimeEvent, target: { userId?: string }) {
  for (const peer of peers.values()) {
    // revalida a sessão a cada entrega: sessão expirada/encerrada não recebe dados privados
    if (target.userId) {
      const currentUser = identify(peer.token)
      if (currentUser !== target.userId) continue
    }
    peer.emit(event.type, event)
  }
}

function targetOf(event: RealtimeEvent): { userId?: string } {
  if (event.type === 'order.updated') return { userId: (event as OrderUpdatedEvent).data.order.userId }
  if (event.type === 'wallet.updated') return { userId: (event as WalletUpdatedEvent).data.userId }
  return {}
}

/** Reenvia o último evento (mesmo eventId) — o cliente deve ignorar a duplicata. */
export function replayLast(type?: RealtimeEvent['type']): RealtimeEvent | null {
  const log = db.state.eventLog
  const event = [...log].reverse().find((e) => !type || e.type === type)
  if (!event) return null
  deliver(event, targetOf(event))
  return event
}

/**
 * Envia um evento antigo: novo eventId, mas versão anterior e dados antigos.
 * O cliente não pode regredir o estado.
 */
export function sendStale(type: RealtimeEvent['type'] = 'nft.updated'): RealtimeEvent | null {
  const log = db.state.eventLog.filter((e) => e.type === type)
  const latest = log[log.length - 1]
  if (!latest) return null
  const previous = log.length > 1 ? log[log.length - 2] : null
  let stale: RealtimeEvent
  if (latest.type === 'nft.updated') {
    const data = latest.data
    stale = {
      ...latest,
      eventId: `evt_stale_${db.nextSeq()}`,
      version: Math.max(0, latest.version - 1),
      data: { ...data, price: data.previousPrice, previousPrice: data.price },
    } satisfies NftUpdatedEvent
  } else {
    stale = { ...(previous ?? latest), eventId: `evt_stale_${db.nextSeq()}`, version: Math.max(0, latest.version - 1) } as RealtimeEvent
  }
  deliver(stale, targetOf(stale))
  return stale
}

/** Derruba todas as conexões e recusa novas por `downMs` (simula queda do servidor). */
export function dropConnections(downMs = 0) {
  downUntil = Date.now() + downMs
  for (const peer of peers.values()) peer.close()
  peers.clear()
}

/** Encerra conexões de uma sessão (logout/expiração no servidor). */
export function dropSession(token: string) {
  for (const peer of peers.values()) {
    if (peer.token === token) {
      peer.userId = null
    }
  }
}

export function realtimeStats() {
  return {
    connections: peers.size,
    authenticated: [...peers.values()].filter((p) => p.userId).length,
    downUntil: downUntil > Date.now() ? new Date(downUntil).toISOString() : null,
  }
}

export function nextEventId() {
  return `evt_${db.nextSeq()}`
}
