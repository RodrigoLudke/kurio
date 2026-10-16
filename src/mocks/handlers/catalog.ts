import { HttpResponse } from 'msw'
import {
  CATALOG_SORTS,
  CATALOG_TABS,
  CATEGORIES,
  CATEGORY_LABEL,
  NETWORKS,
  NETWORK_LABEL,
  type CatalogQuery,
  type CatalogResponse,
  type CatalogSort,
  type CatalogTab,
  type CategoryId,
  type FeaturedResponse,
  type NetworkId,
} from '@/api/contracts'
import { compareEth, isEthString, maxEth, minEth } from '@/lib/eth'
import { db, findNft } from '../db'
import { priceOf, toDetail, toSummary } from '../domain'
import type { NftRecord } from '../fixtures'
import { fail, mockConfig, route, validationError } from '../runtime'

const NEW_WINDOW_MS = 7 * 24 * 3_600_000
const TRENDING_THRESHOLD = 600

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | 'invalid' {
  if (!raw) return []
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.some((p) => !allowed.includes(p as T))) return 'invalid'
  return [...new Set(parts)] as T[]
}

function parseQuery(url: URL): Required<Pick<CatalogQuery, 'sort' | 'tab' | 'page' | 'pageSize'>> & CatalogQuery {
  const p = url.searchParams
  const errors: Record<string, string> = {}
  const category = parseList<CategoryId>(p.get('category'), CATEGORIES)
  const network = parseList<NetworkId>(p.get('network'), NETWORKS)
  if (category === 'invalid') errors.category = 'Categoria desconhecida.'
  if (network === 'invalid') errors.network = 'Rede desconhecida.'
  const sort = (p.get('sort') ?? 'recent') as CatalogSort
  if (!CATALOG_SORTS.includes(sort)) errors.sort = 'Ordenação inválida.'
  const tab = (p.get('tab') ?? 'all') as CatalogTab
  if (!CATALOG_TABS.includes(tab)) errors.tab = 'Aba inválida.'
  const page = Number(p.get('page') ?? '1')
  const pageSize = Number(p.get('pageSize') ?? '9')
  if (!Number.isInteger(page) || page < 1) errors.page = 'Página inválida.'
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) errors.pageSize = 'Tamanho de página inválido.'
  const minPrice = p.get('minPrice') ?? undefined
  const maxPrice = p.get('maxPrice') ?? undefined
  if (minPrice && !isEthString(minPrice)) errors.minPrice = 'Preço mínimo inválido.'
  if (maxPrice && !isEthString(maxPrice)) errors.maxPrice = 'Preço máximo inválido.'
  if (Object.keys(errors).length) throw validationError(errors, 'Parâmetros de busca inválidos.')
  return {
    q: p.get('q')?.trim() || undefined,
    category: category as CategoryId[],
    network: network as NetworkId[],
    minPrice,
    maxPrice,
    sort,
    tab,
    page,
    pageSize,
  }
}

type Filter = (nft: NftRecord) => boolean

function buildFilters(query: CatalogQuery, newest: number) {
  const q = query.q ? normalize(query.q) : null
  const filters: Record<'q' | 'category' | 'network' | 'price' | 'tab', Filter> = {
    q: (n) => !q || normalize(`${n.name} ${n.collectionName} ${n.creator} ${n.tokenId}`).includes(q),
    category: (n) => !query.category?.length || query.category.includes(n.category),
    network: (n) => !query.network?.length || query.network.includes(n.network),
    price: (n) => {
      const price = priceOf(n)
      if (query.minPrice && compareEth(price, query.minPrice) < 0) return false
      if (query.maxPrice && compareEth(price, query.maxPrice) > 0) return false
      return true
    },
    tab: (n) =>
      query.tab === 'new'
        ? newest - Date.parse(n.listedAt) <= NEW_WINDOW_MS
        : query.tab === 'trending'
          ? n.trendingScore >= TRENDING_THRESHOLD
          : true,
  }
  return filters
}

function sortNfts(items: NftRecord[], sort: CatalogSort) {
  const sorted = [...items]
  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => compareEth(priceOf(a), priceOf(b)) || a.name.localeCompare(b.name))
    case 'price_desc':
      return sorted.sort((a, b) => compareEth(priceOf(b), priceOf(a)) || a.name.localeCompare(b.name))
    case 'name_asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    default:
      return sorted.sort((a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt) || a.name.localeCompare(b.name))
  }
}

export const catalogHandlers = [
  route('get', '/nfts', ({ request }) => {
    const query = parseQuery(new URL(request.url))
    const all = mockConfig.get().emptyCatalog ? [] : db.state.nfts
    const newest = Math.max(0, ...db.state.nfts.map((n) => Date.parse(n.listedAt)))
    const filters = buildFilters(query, newest)
    const pass = (n: NftRecord, skip?: keyof typeof filters) =>
      (Object.keys(filters) as (keyof typeof filters)[]).every((k) => k === skip || filters[k](n))

    const matched = sortNfts(all.filter((n) => pass(n)), query.sort)
    const totalPages = Math.max(1, Math.ceil(matched.length / query.pageSize))
    const start = (query.page - 1) * query.pageSize
    const prices = db.state.nfts.map(priceOf)

    const body: CatalogResponse = {
      items: matched.slice(start, start + query.pageSize).map(toSummary),
      page: query.page,
      pageSize: query.pageSize,
      total: matched.length,
      totalPages,
      facets: {
        // cada faceta conta considerando os demais filtros ativos
        categories: CATEGORIES.map((id) => ({
          id,
          label: CATEGORY_LABEL[id],
          count: all.filter((n) => n.category === id && pass(n, 'category')).length,
        })),
        networks: NETWORKS.map((id) => ({
          id,
          label: NETWORK_LABEL[id],
          count: all.filter((n) => n.network === id && pass(n, 'network')).length,
        })),
        priceRange: {
          min: prices.length ? prices.reduce(minEth) : '0',
          max: prices.length ? prices.reduce(maxEth) : '0',
        },
      },
      appliedQuery: query,
    }
    return HttpResponse.json(body)
  }),

  route('get', '/nfts/featured', () => {
    const pick = (id: string) => {
      const nft = findNft(id)
      if (!nft) fail(404, 'NFT_NOT_FOUND', 'Destaque indisponível.')
      return toSummary(nft)
    }
    const body: FeaturedResponse = {
      spotlight: pick('sage-nomad-009'),
      promos: [
        {
          id: 'genesis',
          title: 'Lançamentos gênesis de edição limitada',
          description: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
          nft: pick('emerald-ape-042'),
        },
        {
          id: 'curated',
          title: 'Arte digital selecionada e muito mais',
          description: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
          nft: pick('neon-vessel-552'),
        },
      ],
    }
    return HttpResponse.json(body)
  }),

  route<{ id: string }>('get', '/nfts/:id', ({ params }) => {
    const nft = findNft(String(params.id))
    if (!nft) fail(404, 'NFT_NOT_FOUND', 'Não encontramos este NFT. Ele pode ter sido removido do mercado.')
    return HttpResponse.json(toDetail(nft))
  }),

  route<{ id: string }>('get', '/nfts/:id/related', ({ params }) => {
    const nft = findNft(String(params.id))
    if (!nft) fail(404, 'NFT_NOT_FOUND', 'NFT inexistente.')
    const related = db.state.nfts.filter((n) => n.id !== nft.id && n.collectionName === nft.collectionName).slice(0, 5)
    const others = db.state.nfts.filter((n) => n.id !== nft.id && !related.includes(n)).slice(0, 10 - related.length)
    return HttpResponse.json({ items: [...related, ...others].map(toSummary) })
  }),
]
