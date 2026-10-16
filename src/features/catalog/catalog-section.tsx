import { Loader2, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CATALOG_SORTS, CATALOG_SORT_LABEL, CATALOG_TABS, CATALOG_TAB_LABEL, CATEGORY_LABEL, NETWORK_LABEL, type CatalogSort, type CategoryId, type NetworkId } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { NftCard, NftCardSkeleton } from '@/features/nft/nft-card'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useCatalog } from '@/queries/catalog'
import { CatalogFilters } from './filters'
import { Pagination } from './pagination'
import { countActiveFilters, PAGE_SIZE } from './search'
import { useCatalogSearch } from './use-catalog-search'

interface CatalogSectionProps {
  route: '/' | '/mercado'
  /** conteúdo extra abaixo dos filtros no desktop (ex.: NFT em destaque) */
  aside?: ReactNode
  heading?: ReactNode
  mobileHero?: ReactNode
}

function ActiveChips({ search, onChange, onClear }: { search: ReturnType<typeof useCatalogSearch>['search']; onChange: ReturnType<typeof useCatalogSearch>['update']; onClear: () => void }) {
  const chips: { key: string; label: string; remove: () => void }[] = []
  if (search.q) chips.push({ key: 'q', label: `Busca: “${search.q}”`, remove: () => onChange({ q: undefined }) })
  search.category?.split(',').forEach((c) =>
    chips.push({
      key: `c-${c}`,
      label: CATEGORY_LABEL[c as CategoryId] ?? c,
      remove: () => onChange({ category: search.category!.split(',').filter((x) => x !== c).join(',') || undefined }),
    }),
  )
  search.network?.split(',').forEach((n) =>
    chips.push({
      key: `n-${n}`,
      label: NETWORK_LABEL[n as NetworkId] ?? n,
      remove: () => onChange({ network: search.network!.split(',').filter((x) => x !== n).join(',') || undefined }),
    }),
  )
  if (search.min || search.max) {
    chips.push({
      key: 'price',
      label: `${search.min ? formatEth(search.min) : 'mín.'} – ${search.max ? formatEth(search.max) : 'máx.'}`,
      remove: () => onChange({ min: undefined, max: undefined }),
    })
  }
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-xs text-sand hover:border-orange hover:text-orange focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Remover filtro ${chip.label}`}
        >
          {chip.label}
          <X className="size-3" aria-hidden="true" />
        </button>
      ))}
      <button type="button" onClick={onClear} className="text-xs text-orange underline-offset-4 hover:underline">
        Limpar tudo
      </button>
    </div>
  )
}

function MobileSearch({ value, onCommit, onOpenFilters, activeCount }: { value: string; onCommit: (q: string | undefined) => void; onOpenFilters: () => void; activeCount: number }) {
  const [text, setText] = useState(value)
  const committed = useRef(value)
  useEffect(() => {
    setText(value)
    committed.current = value
  }, [value])
  // debounce: só grava na URL quando o usuário para de digitar
  useEffect(() => {
    if (text.trim() === committed.current) return
    const t = window.setTimeout(() => {
      committed.current = text.trim()
      onCommit(text.trim() || undefined)
    }, 400)
    return () => window.clearTimeout(t)
  }, [text, onCommit])
  return (
    <div className="flex gap-3 md:hidden">
      <form role="search" className="relative flex-1" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="mobile-search" className="sr-only">
          Explorar coleções
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-sand" aria-hidden="true" />
        <input
          id="mobile-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-xl bg-surface pr-3 pl-10 text-sm text-foreground placeholder:text-sand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </form>
      <button
        type="button"
        onClick={onOpenFilters}
        className="relative flex size-11 items-center justify-center rounded-xl bg-brand text-kurio-bg focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={activeCount ? `Filtros (${activeCount} ativos)` : 'Filtros'}
        data-testid="open-filters"
      >
        <SlidersHorizontal className="size-5" aria-hidden="true" />
        {activeCount > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-5 rounded-full bg-foreground px-1 text-center text-xs font-bold text-kurio-bg">
            {activeCount}
          </span>
        )}
      </button>
    </div>
  )
}

export function CatalogSection({ route, aside, heading, mobileHero }: CatalogSectionProps) {
  const { search, query, update, goToPage, clear } = useCatalogSearch(route)
  const catalog = useCatalog(query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const data = catalog.data
  const showSkeleton = catalog.isPending
  const refreshing = catalog.isFetching && !catalog.isPending
  const activeCount = countActiveFilters(search)
  const page = query.page ?? 1

  const onPage = (p: number) => {
    goToPage(p)
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const resultLabel = data ? (data.total === 1 ? '1 NFT encontrado' : `${data.total} NFTs encontrados`) : ''

  return (
    <section aria-labelledby="catalog-title" className="container-kurio">
      <div className="mb-4 flex flex-col gap-4 md:hidden">
        <MobileSearch value={search.q ?? ''} onCommit={(q) => update({ q })} onOpenFilters={() => setFiltersOpen(true)} activeCount={activeCount} />
        {mobileHero}
      </div>
      {heading}
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-8 md:grid-cols-[240px_1fr] lg:grid-cols-[310px_1fr] lg:gap-12">
        <aside className="hidden flex-col gap-6 md:flex" aria-label="Filtros do catálogo">
          <div className="bg-surface px-3 py-5 lg:px-5">
            <CatalogFilters search={search} facets={data?.facets} onChange={update} idPrefix="desktop" />
          </div>
          {aside}
        </aside>

        <div className="flex min-w-0 flex-col gap-6" ref={gridRef} style={{ scrollMarginTop: 16 }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div role="group" aria-label="Listas" className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 md:gap-5">
              {CATALOG_TABS.map((tab) => {
                const active = (search.tab ?? 'all') === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ tab: tab === 'all' ? undefined : tab })}
                    className={cn(
                      'shrink-0 border-b-2 pb-1 text-sm whitespace-nowrap transition-colors hover:text-orange focus-visible:ring-2 focus-visible:ring-ring md:text-[15px]',
                      active ? 'border-brand font-medium text-orange' : 'border-transparent text-foreground',
                    )}
                  >
                    {CATALOG_TAB_LABEL[tab]}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 max-md:justify-between">
              <label id="sort-label" htmlFor="sort-trigger" className="text-sm whitespace-nowrap md:text-[15px]">
                Ordenar por:
              </label>
              <Select value={search.sort ?? 'recent'} onValueChange={(v) => update({ sort: v === 'recent' ? undefined : (v as CatalogSort) })}>
                <SelectTrigger id="sort-trigger" aria-labelledby="sort-label sort-trigger" className="h-9 w-auto min-w-[220px] border-0 bg-transparent px-1 md:text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {CATALOG_SORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CATALOG_SORT_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ActiveChips search={search} onChange={update} onClear={clear} />

          <div className="flex min-h-5 items-center gap-2 text-sm text-sand" role="status" aria-live="polite" data-testid="catalog-status">
            {refreshing ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Atualizando resultados…
              </>
            ) : (
              resultLabel
            )}
          </div>

          {catalog.isError && !data ? (
            <Alert tone="error" className="flex-col items-start" data-testid="catalog-error">
              <p className="font-bold">Não foi possível carregar o catálogo.</p>
              <p className="text-sand">{errorMessage(catalog.error)}</p>
              <Button size="sm" onClick={() => void catalog.refetch()} className="mt-2">
                <RefreshCw aria-hidden="true" /> Tentar novamente
              </Button>
            </Alert>
          ) : catalog.isError ? (
            <Alert tone="warning" className="items-center justify-between">
              <span>Não foi possível atualizar os resultados. Exibindo a última lista carregada.</span>
              <Button size="sm" variant="outline" onClick={() => void catalog.refetch()}>
                Tentar novamente
              </Button>
            </Alert>
          ) : null}

          {showSkeleton && <span className="sr-only">Carregando NFTs…</span>}
          {showSkeleton ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 pb-8 md:grid-cols-2 md:pb-0 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10" aria-busy="true" data-testid="catalog-loading">
              {Array.from({ length: PAGE_SIZE }, (_, i) => (
                <NftCardSkeleton key={i} className="max-md:even:translate-y-8" />
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-line-strong px-6 py-16 text-center" data-testid="catalog-empty">
              <p className="text-lg font-bold">Nenhum NFT encontrado</p>
              <p className="max-w-md text-sand">Tente outros termos de busca ou remova alguns filtros para ver mais resultados.</p>
              {(activeCount > 0 || search.q || search.tab) && (
                <Button onClick={clear} variant="outline">
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : data ? (
            <div
              className={cn('grid grid-cols-2 gap-x-4 gap-y-6 pb-8 transition-opacity md:grid-cols-2 md:pb-0 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10', refreshing && 'opacity-70')}
              aria-busy={refreshing}
              data-testid="catalog-grid"
            >
              {data.items.map((nft, i) => (
                <NftCard key={nft.id} nft={nft} priority={i < 3} className="max-md:even:translate-y-8" />
              ))}
            </div>
          ) : null}

          {data && data.totalPages > 1 && <Pagination page={page} totalPages={data.totalPages} onChange={onPage} />}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="pb-6">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>{resultLabel || 'Refine o catálogo por coleção, preço e rede.'}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <CatalogFilters search={search} facets={data?.facets} onChange={update} idPrefix="mobile" />
          </div>
          <div className="flex gap-3 px-4">
            <Button variant="outline" className="flex-1" onClick={clear}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Ver resultados
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

