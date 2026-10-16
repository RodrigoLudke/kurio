/**
 * Ponte entre eventos Socket.IO e o cache do TanStack Query.
 *
 * nft.updated  → corrige preço/disponibilidade no catálogo, destaques e
 *                detalhe (só se o cache tiver versão menor) e revalida o
 *                carrinho no servidor (o servidor marca linhas alteradas).
 * order.updated → grava o pedido no cache do dono (ignora pedidos de outro
 *                usuário) e, se confirmado, revalida carrinho e catálogo.
 * wallet.updated → atualiza o estado de conexão da carteira.
 * reconexão    → invalida os recursos ativos para reconciliar com a API REST.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { Cart, CatalogResponse, FeaturedResponse, NftDetail, NftSummary, NftUpdatedEvent, Order } from '@/api/contracts'
import { sessionStore } from '@/api/session-store'
import { formatEth, compareEth } from '@/lib/eth'
import { announce } from '@/lib/announce'
import { keys } from '@/queries/keys'
import { realtime } from './client'

function patchSummary<T extends NftSummary>(nft: T, event: NftUpdatedEvent): T {
  if (nft.id !== event.data.nftId || nft.version >= event.version) return nft
  return { ...nft, price: event.data.price, compareAtPrice: event.data.compareAtPrice, available: event.data.available, version: event.version }
}

function patchDetail(nft: NftDetail, event: NftUpdatedEvent): NftDetail {
  if (nft.version >= event.version) return nft
  const editions = nft.editions.map((e) => {
    const next = event.data.editions.find((x) => x.type === e.type)
    return next ? { ...e, price: next.price, available: next.available, maxPerOrder: next.maxPerOrder } : e
  })
  return { ...patchSummary(nft, event), editions }
}

export function installRealtimeSync(queryClient: QueryClient) {
  const offNft = realtime.on('nft.updated', (event) => {
    queryClient.setQueriesData<CatalogResponse>({ queryKey: keys.catalogAll() }, (data) =>
      data ? { ...data, items: data.items.map((i) => patchSummary(i, event)) } : data,
    )
    queryClient.setQueryData<FeaturedResponse>(keys.featured(), (data) =>
      data
        ? {
            spotlight: patchSummary(data.spotlight, event),
            promos: data.promos.map((p) => ({ ...p, nft: patchSummary(p.nft, event) })),
          }
        : data,
    )
    queryClient.setQueriesData<{ items: NftSummary[] }>({ queryKey: ['nfts', 'related'] }, (data) =>
      data ? { items: data.items.map((i) => patchSummary(i, event)) } : data,
    )
    queryClient.setQueryData<NftDetail>(keys.nft(event.data.nftId), (data) => (data ? patchDetail(data, event) : data))

    // carrinho: se contém o NFT, informa e busca o resumo recalculado
    const carts = queryClient.getQueriesData<Cart>({ queryKey: keys.cartAll() })
    const lines = carts.flatMap(([, cart]) => cart?.items.filter((i) => i.nftId === event.data.nftId) ?? [])
    const affected = lines.length > 0
    // só alerta disponibilidade quando ela deixa de cobrir a quantidade do carrinho
    const shortage = lines.some((line) => {
      const edition = event.data.editions.find((e) => e.type === line.edition)
      return !!edition && edition.available < line.quantity
    })
    if (affected) {
      void queryClient.invalidateQueries({ queryKey: keys.cartAll() })
      const { price, previousPrice, name, changed, available } = event.data
      if (changed.includes('price') && compareEth(price, previousPrice) !== 0) {
        announce(`O preço de ${name} mudou de ${formatEth(previousPrice)} para ${formatEth(price)}. O resumo do carrinho foi atualizado.`, {
          tone: 'warning',
          toast: true,
        })
      } else if (changed.includes('availability') && shortage) {
        announce(
          available === 0
            ? `${name} esgotou. Revise o carrinho antes de finalizar.`
            : `A disponibilidade de ${name} caiu e não cobre mais a quantidade do seu carrinho.`,
          { tone: 'warning', toast: true },
        )
      }
    }
  })

  const offOrder = realtime.on('order.updated', (event) => {
    const order = event.data.order
    const current = sessionStore.getState().session
    // isolamento: nunca aplica eventos de pedido de outro usuário
    if (!current || order.userId !== current.userId) return
    const key = keys.order(current.userId, order.id)
    const cached = queryClient.getQueryData<Order>(key)
    if (cached && cached.version >= order.version) return
    queryClient.setQueryData(key, order)
    void queryClient.invalidateQueries({ queryKey: keys.orders(current.userId), exact: true })
    if (order.status === 'confirmed') {
      void queryClient.invalidateQueries({ queryKey: keys.cartAll() })
      void queryClient.invalidateQueries({ queryKey: keys.nftsAll() })
    }
  })

  const offWallet = realtime.on('wallet.updated', (event) => {
    const current = sessionStore.getState().session
    if (!current || event.data.userId !== current.userId) return
    queryClient.setQueryData(keys.walletConnection(current.userId, event.data.walletId), { connection: event.data.connection })
    if (!event.data.connection) announce('A carteira foi desconectada. Conecte-a novamente para finalizar a compra.', { tone: 'warning', toast: true })
  })

  const offReconnect = realtime.onReconnect(() => {
    announce('Conexão em tempo real restabelecida. Dados atualizados.', { tone: 'info' })
    void queryClient.invalidateQueries({ queryKey: keys.nftsAll() })
    void queryClient.invalidateQueries({ queryKey: keys.cartAll() })
    const current = sessionStore.getState().session
    if (current) {
      void queryClient.invalidateQueries({ queryKey: keys.orders(current.userId) })
      void queryClient.invalidateQueries({ queryKey: keys.wallets(current.userId) })
    }
  })

  return () => {
    offNft()
    offOrder()
    offWallet()
    offReconnect()
  }
}
