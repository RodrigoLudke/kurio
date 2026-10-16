import { useCallback, useEffect, useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './nft-card'

/**
 * Carrossel horizontal com scroll-snap (arrastável no toque, rolável por
 * teclado) e indicadores de página clicáveis.
 */
export function NftCarousel({ title, items, loading }: { title: string; items: NftSummary[] | undefined; loading: boolean }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el || el.clientWidth <= 0) return
    const total = Math.min(20, Math.max(1, Math.round(el.scrollWidth / el.clientWidth)))
    setPages(total)
    setPage(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)))
  }, [])

  useEffect(() => {
    measure()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, items])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const headingId = `carousel-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={headingId} className="container-kurio mt-16">
      <h2 id={headingId} className="border-b border-line pb-3 text-lg font-bold text-orange">
        {title}
      </h2>
      <ul
        ref={trackRef}
        onScroll={measure}
        className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] md:gap-6 [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        aria-label={`${title}: role horizontalmente para ver mais`}
      >
        {loading || !items
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[calc(50%-0.5rem)] shrink-0 snap-start md:w-[calc(20%-1.2rem)]">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((nft) => (
              <li key={nft.id} className="w-[calc(50%-0.5rem)] shrink-0 snap-start md:w-[calc(20%-1.2rem)]">
                <NftCard nft={nft} />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-1" role="group" aria-label={`Páginas de ${title}`}>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Página ${i + 1} de ${pages}`}
              aria-current={i === page ? 'true' : undefined}
              className="flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn('size-3 rounded-full border border-brand', i === page && 'bg-brand')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
