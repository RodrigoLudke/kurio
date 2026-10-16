/**
 * Estado do catálogo na URL. Busca, filtros, ordenação e página vivem nos
 * search params (sobrevivem a refresh, compartilhamento e histórico).
 * Valores padrão são omitidos para manter a URL limpa.
 */
import {
  CATALOG_SORTS,
  CATALOG_TABS,
  CATEGORIES,
  NETWORKS,
  type CatalogQuery,
  type CatalogSort,
  type CatalogTab,
  type CategoryId,
  type NetworkId,
} from '@/api/contracts'
import { compareEth, isEthString } from '@/lib/eth'

export const PAGE_SIZE = 9

export interface CatalogSearch {
  q?: string
  category?: string
  network?: string
  min?: string
  max?: string
  sort?: CatalogSort
  tab?: CatalogTab
  page?: number
}

function list<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  if (typeof raw !== 'string') return []
  return [...new Set(raw.split(',').map((s) => s.trim()))].filter((s): s is T => allowed.includes(s as T))
}

/** Normaliza parâmetros vindos da URL (valores inválidos são descartados). */
export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const out: CatalogSearch = {}
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : ''
  if (q) out.q = q
  const category = list<CategoryId>(raw.category, CATEGORIES)
  if (category.length) out.category = category.join(',')
  const network = list<NetworkId>(raw.network, NETWORKS)
  if (network.length) out.network = network.join(',')
  const min = typeof raw.min === 'string' && isEthString(raw.min) ? raw.min : undefined
  const max = typeof raw.max === 'string' && isEthString(raw.max) ? raw.max : undefined
  if (min && max && compareEth(min, max) > 0) {
    out.min = max
    out.max = min
  } else {
    if (min) out.min = min
    if (max) out.max = max
  }
  if (typeof raw.sort === 'string' && CATALOG_SORTS.includes(raw.sort as CatalogSort) && raw.sort !== 'recent') out.sort = raw.sort as CatalogSort
  if (typeof raw.tab === 'string' && CATALOG_TABS.includes(raw.tab as CatalogTab) && raw.tab !== 'all') out.tab = raw.tab as CatalogTab
  const page = Number(raw.page)
  if (Number.isInteger(page) && page > 1 && page < 1000) out.page = page
  return out
}

export function toCatalogQuery(search: CatalogSearch): CatalogQuery {
  return {
    q: search.q,
    category: list<CategoryId>(search.category, CATEGORIES),
    network: list<NetworkId>(search.network, NETWORKS),
    minPrice: search.min,
    maxPrice: search.max,
    sort: search.sort ?? 'recent',
    tab: search.tab ?? 'all',
    page: search.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export function selectedList<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  return list<T>(raw, allowed)
}

export function toggleInList(raw: string | undefined, value: string): string | undefined {
  const current = raw ? raw.split(',') : []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  return next.length ? next.join(',') : undefined
}

export function countActiveFilters(search: CatalogSearch): number {
  return (
    (search.category ? search.category.split(',').length : 0) +
    (search.network ? search.network.split(',').length : 0) +
    (search.min || search.max ? 1 : 0)
  )
}

/** Serialização de search params sem JSON: `?category=arte-digital,musica&page=2`. */
export function parseSearch(searchStr: string): Record<string, unknown> {
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr)
  const out: Record<string, unknown> = {}
  params.forEach((value, key) => {
    out[key] = value
  })
  return out
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const str = params.toString().replace(/%2C/g, ',')
  return str ? `?${str}` : ''
}
