import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function pagesToShow(page: number, total: number): (number | 'gap')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total))
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p))
  if (page >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => set.add(p))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('gap')
    out.push(p)
  })
  return out
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  const cell =
    'flex size-9 items-center justify-center rounded-sm border border-line text-[15px] transition-colors hover:border-orange hover:text-orange focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <button type="button" className={cell} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </li>
        {pagesToShow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-sand">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Página ${p}`}
                className={cn(cell, p === page && 'border-brand bg-brand font-bold text-kurio-bg hover:text-kurio-bg')}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button type="button" className={cell} onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
