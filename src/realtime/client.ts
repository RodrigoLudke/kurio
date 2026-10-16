/**
 * Cliente Socket.IO da aplicação.
 *
 * - Conecta com o token da sessão (`auth.token`); ao trocar de usuário ou sair,
 *   o socket anterior é encerrado e todos os seus listeners removidos.
 * - Deduplica eventos por `eventId` e descarta versões antigas por recurso,
 *   então duplicatas e eventos atrasados nunca regridem o estado nem
 *   reaplicam efeitos.
 * - Após reconexão, notifica para que os recursos ativos sejam reconciliados
 *   com a API REST.
 */
import type { Socket } from 'socket.io-client'
import type { RealtimeClientToServer, RealtimeEvent, RealtimeServerToClient } from '@/api/contracts'
import { whenTransportReady } from '@/api/client'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

type EventType = RealtimeEvent['type']
type Handler<T extends EventType> = (event: Extract<RealtimeEvent, { type: T }>) => void
type AnyHandler = (event: RealtimeEvent) => void

const URL = import.meta.env.VITE_REALTIME_URL ?? 'wss://realtime.kurio.mock'
const MAX_SEEN = 500

class RealtimeClient {
  private socket: Socket<RealtimeServerToClient, RealtimeClientToServer> | null = null
  private generation = 0
  private seen: string[] = []
  private seenSet = new Set<string>()
  private versions = new Map<string, number>()
  private handlers = new Map<EventType, Set<AnyHandler>>()
  private reconnectListeners = new Set<() => void>()
  private statusListeners = new Set<() => void>()
  private _status: RealtimeStatus = 'idle'
  private hasConnected = false
  private _userId: string | null = null

  get status() {
    return this._status
  }

  get userId() {
    return this._userId
  }

  private setStatus(status: RealtimeStatus) {
    if (this._status === status) return
    this._status = status
    this.statusListeners.forEach((l) => l())
  }

  subscribeStatus = (listener: () => void) => {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  getStatus = () => this._status

  /** (Re)conecta para a sessão informada. Chamadas repetidas com o mesmo token são ignoradas. */
  async connect(token: string | null, userId: string | null) {
    const generation = ++this.generation
    this.teardown()
    // eventos privados da sessão anterior não valem mais
    for (const key of [...this.versions.keys()]) if (!key.startsWith('nft:')) this.versions.delete(key)
    this._userId = userId
    this.setStatus('connecting')
    await whenTransportReady()
    // o tempo real não participa da primeira renderização (os dados vêm por
    // REST): a conexão espera o navegador ficar ocioso para não competir com
    // o carregamento inicial
    await new Promise<void>((resolve) =>
      'requestIdleCallback' in window ? window.requestIdleCallback(() => resolve(), { timeout: 1500 }) : setTimeout(resolve, 300),
    )
    // import tardio: o engine.io-client captura o construtor global de
    // WebSocket ao ser carregado; com mocks, ele precisa ser carregado depois
    // que o MSW instala o interceptador.
    const { io } = await import('socket.io-client')
    if (generation !== this.generation) return // outra conexão foi solicitada nesse meio-tempo

    const socket: Socket<RealtimeServerToClient, RealtimeClientToServer> = io(URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 3000,
      timeout: 8000,
    })
    this.socket = socket

    socket.on('connect', () => {
      this.setStatus('connected')
      if (this.hasConnected) this.reconnectListeners.forEach((l) => l())
      this.hasConnected = true
    })
    socket.on('disconnect', (reason) => {
      // "io client disconnect" = encerramento intencional (logout/troca de usuário)
      if (reason === 'io client disconnect') return
      this.setStatus('reconnecting')
    })
    socket.on('connect_error', () => {
      this.setStatus(this.hasConnected ? 'reconnecting' : 'offline')
    })
    socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'))

    socket.on('nft.updated', (e) => this.dispatch(e))
    socket.on('order.updated', (e) => this.dispatch(e))
    socket.on('wallet.updated', (e) => this.dispatch(e))
  }

  disconnect() {
    this.generation++
    this.teardown()
    this._userId = null
    this.setStatus('idle')
  }

  private teardown() {
    if (!this.socket) return
    this.socket.removeAllListeners()
    this.socket.io.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    this.hasConnected = false
  }

  /** Versão conhecida de um recurso (também alimentada pelas respostas REST). */
  noteVersion(resource: string, version: number) {
    const current = this.versions.get(resource) ?? 0
    if (version > current) this.versions.set(resource, version)
  }

  knownVersion(resource: string) {
    return this.versions.get(resource) ?? 0
  }

  private dispatch(event: RealtimeEvent) {
    if (!event || typeof event.eventId !== 'string') return
    if (this.seenSet.has(event.eventId)) return // duplicata
    this.seen.push(event.eventId)
    this.seenSet.add(event.eventId)
    if (this.seen.length > MAX_SEEN) this.seenSet.delete(this.seen.shift()!)

    const resourceKey = `${event.resource.type}:${event.resource.id}`
    if (event.version <= this.knownVersion(resourceKey)) return // evento antigo
    this.versions.set(resourceKey, event.version)

    this.handlers.get(event.type)?.forEach((h) => h(event))
  }

  on<T extends EventType>(type: T, handler: Handler<T>) {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as AnyHandler)
    return () => {
      set.delete(handler as AnyHandler)
    }
  }

  onReconnect(listener: () => void) {
    this.reconnectListeners.add(listener)
    return () => {
      this.reconnectListeners.delete(listener)
    }
  }
}

export const realtime = new RealtimeClient()
