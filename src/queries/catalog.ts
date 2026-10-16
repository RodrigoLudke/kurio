import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { nftsApi } from '@/api/endpoints'
import { keys } from './keys'

/**
 * Catálogo: a chave inclui todos os parâmetros, então cada combinação tem
 * seu próprio cache. Ao mudar filtros, a requisição anterior é cancelada
 * (AbortSignal) e, se ainda assim chegar depois, é gravada na chave antiga —
 * nunca sobrescreve a tela atual (respostas fora de ordem são descartadas).
 */
export function useCatalog(query: CatalogQuery) {
  return useQuery({
    queryKey: keys.catalog(query),
    queryFn: ({ signal }) => nftsApi.list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useFeatured() {
  return useQuery({
    queryKey: keys.featured(),
    queryFn: ({ signal }) => nftsApi.featured({ signal }),
    staleTime: 60_000,
  })
}

export function useNft(id: string) {
  return useQuery({
    queryKey: keys.nft(id),
    queryFn: ({ signal }) => nftsApi.detail(id, { signal }),
  })
}

export function useRelated(id: string) {
  return useQuery({
    queryKey: keys.related(id),
    queryFn: ({ signal }) => nftsApi.related(id, { signal }),
    staleTime: 60_000,
  })
}
