import type { CatalogQuery } from '@/api/contracts'

/**
 * Chaves de cache. Dados privados ficam sob ['private', userId, ...] para
 * que logout/troca de usuário removam tudo de uma vez e nenhuma consulta de
 * um usuário seja servida a outro. O carrinho é identificado pelo dono
 * (usuário ou carrinho de visitante).
 */
export const keys = {
  catalog: (query: CatalogQuery) => ['nfts', 'list', query] as const,
  catalogAll: () => ['nfts', 'list'] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  related: (id: string) => ['nfts', 'related', id] as const,
  featured: () => ['nfts', 'featured'] as const,
  nftsAll: () => ['nfts'] as const,

  session: (token: string | null) => ['session', token] as const,

  cart: (owner: string) => ['cart', owner] as const,
  cartAll: () => ['cart'] as const,

  privateAll: (userId: string) => ['private', userId] as const,
  favorites: (userId: string) => ['private', userId, 'favorites'] as const,
  profile: (userId: string) => ['private', userId, 'profile'] as const,
  wallets: (userId: string) => ['private', userId, 'wallets'] as const,
  walletConnection: (userId: string, walletId: string) => ['private', userId, 'wallets', walletId, 'connection'] as const,
  orders: (userId: string) => ['private', userId, 'orders'] as const,
  order: (userId: string, orderId: string) => ['private', userId, 'orders', orderId] as const,
}
