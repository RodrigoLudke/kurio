import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { toCatalogQuery, validateCatalogSearch, type CatalogSearch } from './search'

type CatalogRoute = '/' | '/mercado'

/**
 * Lê e atualiza o estado do catálogo na URL. Qualquer alteração de busca,
 * filtro, aba ou ordenação reinicia a paginação; mudanças de página
 * preservam o restante. Cada alteração vira uma entrada no histórico.
 */
export function useCatalogSearch(route: CatalogRoute) {
  const raw = useSearch({ strict: false }) as Record<string, unknown>
  const search = useMemo(() => validateCatalogSearch(raw), [raw])
  const navigate = useNavigate()
  const query = useMemo(() => toCatalogQuery(search), [search])

  const update = useCallback(
    (patch: Partial<CatalogSearch>, options: { keepPage?: boolean; replace?: boolean } = {}) => {
      const next: CatalogSearch = { ...search, ...patch }
      if (!options.keepPage) delete next.page
      for (const key of Object.keys(next) as (keyof CatalogSearch)[]) {
        if (next[key] === undefined || next[key] === '') delete next[key]
      }
      void navigate({ to: route, search: next, replace: options.replace, resetScroll: false })
    },
    [navigate, route, search],
  )

  const goToPage = useCallback((page: number) => update({ page: page > 1 ? page : undefined }, { keepPage: true }), [update])

  const clear = useCallback(() => {
    void navigate({ to: route, search: {}, resetScroll: false })
  }, [navigate, route])

  return { search, query, update, goToPage, clear }
}
