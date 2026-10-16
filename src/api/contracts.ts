/**
 * Contratos REST e de tempo real compartilhados entre transporte (Axios),
 * estado (TanStack Query), interface e servidor simulado (MSW).
 *
 * Toda alteração aqui é verificada pelo TypeScript nas três camadas.
 */
import type { EthString } from '@/lib/eth'

export type { EthString }

/* ------------------------------------------------------------------ */
/* Domínio                                                             */
/* ------------------------------------------------------------------ */

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type NetworkId = (typeof NETWORKS)[number]

export const NETWORK_LABEL: Record<NetworkId, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export type CategoryId = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const EDITION_TYPES = ['1/1', '1/10', '1/50', 'aberta'] as const
export type EditionType = (typeof EDITION_TYPES)[number]

export const EDITION_LABEL: Record<EditionType, string> = {
  '1/1': '1/1',
  '1/10': '1/10',
  '1/50': '1/50',
  aberta: 'ABERTA',
}

export const WALLET_PROVIDERS = ['walletconnect', 'metamask', 'coinbase'] as const
export type WalletProvider = (typeof WALLET_PROVIDERS)[number]

export const WALLET_PROVIDER_LABEL: Record<WalletProvider, string> = {
  walletconnect: 'WalletConnect',
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
}

export interface ImageAsset {
  /** caminho da imagem principal (maior resolução disponível) */
  src: string
  /** srcset com larguras disponíveis */
  srcSet: string
  width: number
  height: number
  alt: string
}

export interface Edition {
  type: EditionType
  price: EthString
  /** unidades disponíveis agora; 0 = esgotada */
  available: number
  /** tiragem total; null = edição aberta */
  supply: number | null
  /** limite por pedido (já considera a disponibilidade) */
  maxPerOrder: number
}

export interface NftSummary {
  id: string
  tokenId: string
  name: string
  image: ImageAsset
  category: CategoryId
  collectionName: string
  network: NetworkId
  /** preço da edição padrão */
  price: EthString
  /** preço anterior (exibido riscado) */
  compareAtPrice: EthString | null
  badge: 'raro' | 'novo' | null
  rating: number
  reviewCount: number
  listedAt: string
  /** soma da disponibilidade de todas as edições */
  available: number
  defaultEdition: EditionType
  /** versão monotônica do recurso; usada para ordenar eventos em tempo real */
  version: number
}

export interface NftReview {
  id: string
  author: string
  rating: number
  comment: string
  createdAt: string
}

export interface NftDetail extends NftSummary {
  description: string
  longDescription: string[]
  attributes: string[]
  editions: Edition[]
  gallery: ImageAsset[]
  creator: string
  royaltiesPercent: number
  contractAddress: string
  standard: 'ERC-721' | 'ERC-1155'
  reviews: NftReview[]
}

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

export const CATALOG_SORTS = ['recent', 'price_asc', 'price_desc', 'name_asc'] as const
export type CatalogSort = (typeof CATALOG_SORTS)[number]

export const CATALOG_SORT_LABEL: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  name_asc: 'Nome (A–Z)',
}

export const CATALOG_TABS = ['all', 'new', 'trending'] as const
export type CatalogTab = (typeof CATALOG_TABS)[number]

export const CATALOG_TAB_LABEL: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

/** Parâmetros aceitos por GET /nfts (refletem exatamente o estado da URL). */
export interface CatalogQuery {
  q?: string
  category?: CategoryId[]
  network?: NetworkId[]
  minPrice?: EthString
  maxPrice?: EthString
  sort?: CatalogSort
  tab?: CatalogTab
  page?: number
  pageSize?: number
}

export interface FacetCount<T extends string> {
  id: T
  label: string
  count: number
}

export interface CatalogResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    categories: FacetCount<CategoryId>[]
    networks: FacetCount<NetworkId>[]
    priceRange: { min: EthString; max: EthString }
  }
  /** eco dos parâmetros efetivamente aplicados pelo servidor */
  appliedQuery: Required<Pick<CatalogQuery, 'sort' | 'tab' | 'page' | 'pageSize'>> & CatalogQuery
}

export interface FeaturedResponse {
  spotlight: NftSummary
  promos: { id: string; title: string; description: string; nft: NftSummary }[]
}

/* ------------------------------------------------------------------ */
/* Sessão e conta                                                      */
/* ------------------------------------------------------------------ */

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: string
}

export interface AuthResponse {
  user: User
  session: Session
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface Profile extends User {
  ensName: string
  walletNickname: string
  updatedAt: string
}

export interface UpdateProfileRequest {
  displayName: string
  username: string
  email: string
  ensName: string
  walletNickname: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/* ------------------------------------------------------------------ */
/* Carteiras                                                           */
/* ------------------------------------------------------------------ */

export type WalletSlot = 'primary' | 'secondary'

export interface WalletInput {
  displayName: string
  nickname: string
  network: NetworkId
  profileName: string
  address: string
  secondaryAddress: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
}

export interface Wallet extends WalletInput {
  id: string
  slot: WalletSlot
  updatedAt: string
}

export interface CreateWalletRequest extends WalletInput {
  slot: WalletSlot
}

export interface WalletConnection {
  walletId: string
  provider: WalletProvider
  network: NetworkId
  status: 'connected'
  connectedAt: string
}

export interface ConnectWalletRequest {
  provider: WalletProvider
  network: NetworkId
}

/* ------------------------------------------------------------------ */
/* Favoritos                                                           */
/* ------------------------------------------------------------------ */

export interface FavoritesResponse {
  nftIds: string[]
  items: NftSummary[]
}

/* ------------------------------------------------------------------ */
/* Carrinho e cotação                                                  */
/* ------------------------------------------------------------------ */

export type CartLineStatus = 'ok' | 'price_changed' | 'insufficient' | 'sold_out'

export interface CartItem {
  /** `${nftId}:${edition}` */
  id: string
  nftId: string
  edition: EditionType
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
  /** preço que o colecionador viu ao adicionar/confirmar; difere de unitPrice quando houve alteração */
  acknowledgedUnitPrice: EthString
  available: number
  maxQuantity: number
  status: CartLineStatus
  nft: Pick<NftSummary, 'name' | 'tokenId' | 'image' | 'network' | 'version'>
}

export interface Coupon {
  code: string
  description: string
  kind: 'percent' | 'fixed'
  value: string
}

export interface PriceSummary {
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  network: NetworkId
  feeEstimated: boolean
}

export interface Cart {
  id: string
  owner: 'guest' | 'user'
  items: CartItem[]
  coupon: Coupon | null
  summary: PriceSummary
  itemCount: number
  /** true quando alguma linha exige atenção (preço alterado/indisponível) */
  hasIssues: boolean
  version: number
  updatedAt: string
}

export interface AddCartItemRequest {
  nftId: string
  edition: EditionType
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface ApplyCouponRequest {
  code: string
}

export interface MergeCartRequest {
  guestCartId: string
}

export interface QuoteLine {
  nftId: string
  edition: EditionType
  name: string
  tokenId: string
  image: ImageAsset
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
  nftVersion: number
}

export interface Quote extends PriceSummary {
  id: string
  cartVersion: number
  lines: QuoteLine[]
  coupon: Coupon | null
  issuedAt: string
  expiresAt: string
}

export interface CreateQuoteRequest {
  network: NetworkId
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface CollectorInfo {
  displayName: string
  username: string
  profileName: string
  email: string
  walletAddress: string
  secondaryAddress: string
  referralCode: string
  ensName: string
  note: string
}

export interface CreateOrderRequest {
  quoteId: string
  walletId: string
  provider: WalletProvider
  network: NetworkId
  collector: CollectorInfo
}

export type OrderItem = QuoteLine

export interface Order {
  id: string
  number: string
  userId: string
  status: OrderStatus
  version: number
  items: OrderItem[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  coupon: Coupon | null
  network: NetworkId
  wallet: { id: string; label: string; address: string; provider: WalletProvider }
  transactionHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
}

export interface OrderListResponse {
  items: Order[]
}

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NFT_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'AVAILABILITY_CONFLICT'
  | 'EDITION_UNAVAILABLE'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'CART_EMPTY'
  | 'CART_HAS_ISSUES'
  | 'QUOTE_STALE'
  | 'QUOTE_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'WALLET_REJECTED'
  | 'WALLET_NOT_CONNECTED'
  | 'WALLET_NOT_FOUND'
  | 'WALLET_SLOT_TAKEN'
  | 'INVALID_PASSWORD'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA'
  | 'TRANSIENT'
  | 'INTERNAL'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** erros por campo, chave = nome do campo no request */
    fieldErrors?: Record<string, string>
    retryable?: boolean
    details?: unknown
  }
}

/** detalhes de QUOTE_STALE: a nova cotação e o que mudou */
export interface QuoteStaleDetails {
  quote: Quote
  changes: QuoteChange[]
}

export interface QuoteChange {
  nftId: string
  edition: EditionType
  name: string
  kind: 'price' | 'availability' | 'removed' | 'coupon' | 'fee'
  before: string
  after: string
}

/* ------------------------------------------------------------------ */
/* Tempo real (Socket.IO)                                              */
/* ------------------------------------------------------------------ */

export interface RealtimeEnvelope<TType extends string, TData> {
  /** identidade estável do evento — duplicatas compartilham o mesmo id */
  eventId: string
  type: TType
  resource: { type: 'nft' | 'order' | 'wallet'; id: string }
  /** versão do recurso após o evento; eventos com versão <= conhecida são descartados */
  version: number
  occurredAt: string
  data: TData
}

export interface NftUpdatedData {
  nftId: string
  name: string
  price: EthString
  previousPrice: EthString
  compareAtPrice: EthString | null
  available: number
  editions: Pick<Edition, 'type' | 'price' | 'available' | 'maxPerOrder'>[]
  changed: ('price' | 'availability')[]
}

export interface OrderUpdatedData {
  order: Order
}

export interface WalletUpdatedData {
  walletId: string
  userId: string
  connection: WalletConnection | null
  reason: 'disconnected' | 'connected'
}

export type NftUpdatedEvent = RealtimeEnvelope<'nft.updated', NftUpdatedData>
export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', OrderUpdatedData>
export type WalletUpdatedEvent = RealtimeEnvelope<'wallet.updated', WalletUpdatedData>
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent | WalletUpdatedEvent

export interface RealtimeServerToClient {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  'wallet.updated': (event: WalletUpdatedEvent) => void
  'session.ready': (info: { userId: string | null; serverTime: string }) => void
}

export interface RealtimeClientToServer {
  'order.watch': (orderId: string) => void
}

/** handshake: enviado em `auth` do socket.io-client */
export interface RealtimeAuth {
  token: string | null
}
