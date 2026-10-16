/**
 * "Banco" do servidor simulado. Estado único e consistente entre catálogo,
 * favoritos, carrinho, perfil, carteiras, cotações e pedidos — tanto as
 * respostas REST quanto os eventos Socket.IO leem daqui.
 *
 * Persistido em localStorage (sustenta refresh). `resetDb()` restaura
 * integralmente as fixtures.
 */
import type {
  NetworkId,
  Order,
  Quote,
  RealtimeEvent,
  WalletProvider,
} from '@/api/contracts'
import { readJson, writeJson } from '@/lib/storage'
import {
  buildCoupons,
  buildNfts,
  buildUsers,
  buildWallets,
  type CartRecord,
  type CouponRecord,
  type NftRecord,
  type UserRecord,
  type WalletRecord,
} from './fixtures'

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
  revoked: boolean
}

export interface ConnectionRecord {
  walletId: string
  userId: string
  provider: WalletProvider
  network: NetworkId
  connectedAt: string
}

export interface QuoteRecord {
  quote: Quote
  userId: string
  cartId: string
}

export interface OrderRecord {
  order: Order
  idempotencyKey: string
  /** epoch ms em que o pagamento simulado será resolvido; null = manual */
  resolveAt: number | null
}

export interface IdempotencyRecord {
  key: string
  userId: string
  fingerprint: string
  orderId: string
  /** a primeira resposta já foi entregue (usado no cenário de timeout) */
  delivered: boolean
}

export interface DbState {
  schema: 1
  nfts: NftRecord[]
  users: UserRecord[]
  sessions: SessionRecord[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  wallets: WalletRecord[]
  connections: Record<string, ConnectionRecord>
  coupons: CouponRecord[]
  quotes: Record<string, QuoteRecord>
  orders: OrderRecord[]
  idempotency: Record<string, IdempotencyRecord>
  /** últimos eventos publicados (para reenvio de duplicatas/eventos antigos) */
  eventLog: RealtimeEvent[]
  seq: number
  checkoutMutationDone: boolean
}

const DB_KEY = 'kurio.mock.db.v1'

export function seedDb(): DbState {
  const now = '2026-10-01T12:00:00.000Z'
  return {
    schema: 1,
    nfts: buildNfts(),
    users: buildUsers(),
    sessions: [],
    favorites: { usr_ana: ['emerald-ape-042', 'golden-signal-160'], usr_bruno: [] },
    carts: {
      'user:usr_ana': {
        id: 'user:usr_ana',
        owner: 'user',
        userId: 'usr_ana',
        lines: [
          { nftId: 'emerald-ape-042', edition: '1/50', quantity: 2, acknowledgedUnitPrice: '1.19' },
          { nftId: 'violet-nomad-314', edition: '1/50', quantity: 6, acknowledgedUnitPrice: '1.39' },
          { nftId: 'ivory-baron-088', edition: '1/50', quantity: 9, acknowledgedUnitPrice: '1.79' },
        ],
        couponCode: null,
        version: 1,
        updatedAt: now,
      },
      'user:usr_bruno': { id: 'user:usr_bruno', owner: 'user', userId: 'usr_bruno', lines: [], couponCode: null, version: 1, updatedAt: now },
    },
    wallets: buildWallets(),
    connections: {},
    coupons: buildCoupons(),
    quotes: {},
    orders: [],
    idempotency: {},
    eventLog: [],
    seq: 0,
    checkoutMutationDone: false,
  }
}

function ensureStock(state: DbState): DbState {
  // garante estoque suficiente para o carrinho semeado da usuária demo
  const ivory = state.nfts.find((n) => n.id === 'ivory-baron-088')
  const edition = ivory?.editions.find((e) => e.type === '1/50')
  if (edition && edition.available < 9) edition.available = 18
  const violet = state.nfts.find((n) => n.id === 'violet-nomad-314')
  const vEdition = violet?.editions.find((e) => e.type === '1/50')
  if (vEdition && vEdition.available < 6) vEdition.available = 14
  return state
}

let state: DbState = load()

function load(): DbState {
  const stored = readJson<DbState>(DB_KEY)
  if (stored && stored.schema === 1) return stored
  return ensureStock(seedDb())
}

export const db = {
  get state(): DbState {
    return state
  },
  /** aplica uma mutação e persiste */
  mutate<T>(fn: (draft: DbState) => T): T {
    const result = fn(state)
    persist()
    return result
  },
  nextSeq(): number {
    state.seq += 1
    return state.seq
  },
}

export function persist() {
  writeJson(DB_KEY, state)
}

export function resetDb() {
  state = ensureStock(seedDb())
  persist()
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function findNft(id: string): NftRecord | undefined {
  return state.nfts.find((n) => n.id === id)
}

export function findUser(id: string): UserRecord | undefined {
  return state.users.find((u) => u.id === id)
}

export function findSession(token: string): SessionRecord | undefined {
  return state.sessions.find((s) => s.token === token)
}

export function walletsOf(userId: string): WalletRecord[] {
  return state.wallets.filter((w) => w.userId === userId)
}
