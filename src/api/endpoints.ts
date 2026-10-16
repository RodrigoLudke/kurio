/**
 * Funções de acesso REST — única porta de saída HTTP da aplicação.
 * Cada função recebe/retorna tipos de `contracts.ts`.
 */
import { del, get, patch, post, put } from './client'
import type {
  AddCartItemRequest,
  ApplyCouponRequest,
  AuthResponse,
  Cart,
  CatalogQuery,
  CatalogResponse,
  ChangePasswordRequest,
  ConnectWalletRequest,
  CreateOrderRequest,
  CreateQuoteRequest,
  CreateWalletRequest,
  FavoritesResponse,
  FeaturedResponse,
  LoginRequest,
  MergeCartRequest,
  NetworkId,
  NftDetail,
  NftSummary,
  Order,
  OrderListResponse,
  Profile,
  Quote,
  RegisterRequest,
  UpdateCartItemRequest,
  UpdateProfileRequest,
  User,
  Wallet,
  WalletConnection,
  WalletInput,
} from './contracts'

type Signal = { signal?: AbortSignal }

/** Serializa o estado do catálogo exatamente como o servidor espera. */
export function catalogParams(query: CatalogQuery): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.q) params.q = query.q
  if (query.category?.length) params.category = query.category.join(',')
  if (query.network?.length) params.network = query.network.join(',')
  if (query.minPrice) params.minPrice = query.minPrice
  if (query.maxPrice) params.maxPrice = query.maxPrice
  if (query.sort) params.sort = query.sort
  if (query.tab) params.tab = query.tab
  if (query.page) params.page = String(query.page)
  if (query.pageSize) params.pageSize = String(query.pageSize)
  return params
}

export const nftsApi = {
  list: (query: CatalogQuery, { signal }: Signal = {}) =>
    get<CatalogResponse>('/nfts', { params: catalogParams(query), signal }),
  featured: ({ signal }: Signal = {}) => get<FeaturedResponse>('/nfts/featured', { signal }),
  detail: (id: string, { signal }: Signal = {}) => get<NftDetail>(`/nfts/${encodeURIComponent(id)}`, { signal }),
  related: (id: string, { signal }: Signal = {}) =>
    get<{ items: NftSummary[] }>(`/nfts/${encodeURIComponent(id)}/related`, { signal }),
}

export const authApi = {
  login: (body: LoginRequest) => post<AuthResponse>('/auth/login', body),
  register: (body: RegisterRequest) => post<AuthResponse>('/auth/register', body),
  session: ({ signal }: Signal = {}) => get<{ user: User; session: { expiresAt: string } }>('/auth/session', { signal }),
  logout: () => post<void>('/auth/logout'),
}

export const favoritesApi = {
  list: ({ signal }: Signal = {}) => get<FavoritesResponse>('/favorites', { signal }),
  add: (nftId: string) => put<{ nftIds: string[] }>(`/favorites/${encodeURIComponent(nftId)}`),
  remove: (nftId: string) => del<{ nftIds: string[] }>(`/favorites/${encodeURIComponent(nftId)}`),
}

export const cartApi = {
  get: ({ signal, network }: Signal & { network?: NetworkId } = {}) => get<Cart>('/cart', { signal, params: network ? { network } : undefined }),
  addItem: (body: AddCartItemRequest) => post<Cart>('/cart/items', body),
  updateItem: (itemId: string, body: UpdateCartItemRequest) =>
    patch<Cart>(`/cart/items/${encodeURIComponent(itemId)}`, body),
  removeItem: (itemId: string) => del<Cart>(`/cart/items/${encodeURIComponent(itemId)}`),
  applyCoupon: (body: ApplyCouponRequest) => post<Cart>('/cart/coupon', body),
  removeCoupon: () => del<Cart>('/cart/coupon'),
  acknowledge: () => post<Cart>('/cart/acknowledge'),
  merge: (body: MergeCartRequest) => post<Cart>('/cart/merge', body),
}

export const checkoutApi = {
  quote: (body: CreateQuoteRequest) => post<Quote>('/checkout/quote', body),
}

export const ordersApi = {
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } }),
  get: (id: string, { signal }: Signal = {}) => get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }),
  list: ({ signal }: Signal = {}) => get<OrderListResponse>('/orders', { signal }),
}

export const profileApi = {
  get: ({ signal }: Signal = {}) => get<Profile>('/profile', { signal }),
  update: (body: UpdateProfileRequest) => patch<Profile>('/profile', body),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return post<Profile>('/profile/avatar', form)
  },
  removeAvatar: () => del<Profile>('/profile/avatar'),
  changePassword: (body: ChangePasswordRequest) => post<{ ok: true }>('/profile/password', body),
}

export const walletsApi = {
  list: ({ signal }: Signal = {}) => get<{ items: Wallet[] }>('/wallets', { signal }),
  create: (body: CreateWalletRequest) => post<Wallet>('/wallets', body),
  update: (id: string, body: WalletInput) => put<Wallet>(`/wallets/${encodeURIComponent(id)}`, body),
  connection: (id: string, { signal }: Signal = {}) =>
    get<{ connection: WalletConnection | null }>(`/wallets/${encodeURIComponent(id)}/connection`, { signal }),
  connect: (id: string, body: ConnectWalletRequest) =>
    post<{ connection: WalletConnection }>(`/wallets/${encodeURIComponent(id)}/connect`, body),
  disconnect: (id: string) => post<{ connection: null }>(`/wallets/${encodeURIComponent(id)}/disconnect`),
}
