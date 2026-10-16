import { Skeleton } from '@/components/ui/skeleton'

/** Estado de carregamento entre rotas (chunk sob demanda). */
export function PageLoader() {
  return (
    <div className="container-kurio py-10" role="status" aria-live="polite">
      <span className="sr-only">Carregando página…</span>
      <Skeleton className="mb-6 h-6 w-48" />
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}
