import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, NETWORKS, type CatalogResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { selectedList, toggleInList, type CatalogSearch } from './search'

interface FiltersProps {
  search: CatalogSearch
  facets: CatalogResponse['facets'] | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  idPrefix: string
}

/** Converte ETH (string) em centavos de ETH inteiros apenas para posicionar o slider. */
function toCents(value: string) {
  const [whole = '0', fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
}

function fromCents(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

function ptBr(value: string) {
  return value.replace('.', ',')
}

function FacetList<T extends string>({
  title,
  ids,
  items,
  selected,
  onToggle,
  loading,
  headingId,
}: {
  title: string
  ids: readonly T[]
  items: { id: T; label: string; count: number }[] | undefined
  selected: T[]
  onToggle: (id: T) => void
  loading: boolean
  headingId: string
}) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-bold">
        {title}
      </h2>
      <ul className="flex flex-col gap-1">
        {ids.map((id) => {
          const facet = items?.find((i) => i.id === id)
          const active = selected.includes(id)
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-[15px] transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'font-medium text-orange' : 'text-sand',
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className={cn('size-1.5 rounded-full', active ? 'bg-orange' : 'bg-transparent')} />
                  {facet?.label ?? id}
                </span>
                {loading && !facet ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className={cn(active && 'font-bold')}>
                    ({facet?.count ?? 0})<span className="sr-only"> resultados</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function CatalogFilters({ search, facets, onChange, idPrefix }: FiltersProps) {
  const categories = selectedList(search.category, CATEGORIES)
  const networks = selectedList(search.network, NETWORKS)

  const bounds = useMemo(() => {
    if (!facets) return null
    return { min: Math.floor(toCents(facets.priceRange.min)), max: Math.ceil(toCents(facets.priceRange.max)) }
  }, [facets])

  const [range, setRange] = useState<[number, number] | null>(null)
  // mantém o slider coerente com a URL (refresh, histórico)
  useEffect(() => {
    if (!bounds) return
    setRange([search.min ? toCents(search.min) : bounds.min, search.max ? toCents(search.max) : bounds.max])
  }, [bounds, search.min, search.max])

  const applyPrice = () => {
    if (!range || !bounds) return
    const [lo, hi] = range
    onChange({ min: lo > bounds.min ? fromCents(lo) : undefined, max: hi < bounds.max ? fromCents(hi) : undefined })
  }

  return (
    <div className="flex flex-col gap-8">
      <FacetList
        title="Coleções"
        headingId={`${idPrefix}-categories`}
        ids={CATEGORIES}
        items={facets?.categories}
        selected={categories}
        loading={!facets}
        onToggle={(id) => onChange({ category: toggleInList(search.category, id) })}
      />

      <section aria-labelledby={`${idPrefix}-price`} className="flex flex-col gap-4 px-0">
        <h2 id={`${idPrefix}-price`} className="text-lg font-bold">
          Faixa de preço
        </h2>
        {range && bounds ? (
          <>
            <Slider
              min={bounds.min}
              max={bounds.max}
              step={1}
              minStepsBetweenThumbs={1}
              value={range}
              onValueChange={(v) => setRange([v[0] ?? bounds.min, v[1] ?? bounds.max])}
              thumbLabels={['Preço mínimo', 'Preço máximo']}
              className="px-3"
              thumbValueTexts={[`${ptBr(fromCents(range[0]))} ETH`, `${ptBr(fromCents(range[1]))} ETH`]}
            />
            <p className="px-3 text-sm" aria-live="polite">
              Preço: {ptBr(fromCents(range[0]))} - {ptBr(fromCents(range[1]))} ETH
            </p>
            <div className="flex gap-2 px-3">
              <Button size="sm" onClick={applyPrice} className="h-9 px-3 text-sm">
                Aplicar
              </Button>
              {(search.min || search.max) && (
                <Button size="sm" variant="ghost" className="h-9 px-3 text-sm text-sand" onClick={() => onChange({ min: undefined, max: undefined })}>
                  Limpar
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 px-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-20" />
          </div>
        )}
      </section>

      <FacetList
        title="Rede"
        headingId={`${idPrefix}-network`}
        ids={NETWORKS}
        items={facets?.networks}
        selected={networks}
        loading={!facets}
        onToggle={(id) => onChange({ network: toggleInList(search.network, id) })}
      />
    </div>
  )
}
