import { useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Barra superior das telas mobile do layout (voltar + título + ação). */
export function MobileTopBar({ title, action, className, fallback = '/' }: { title?: string; action?: ReactNode; className?: string; fallback?: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className={cn('flex items-center gap-4 px-4 pt-4 pb-2 md:hidden', className)}>
      <button
        type="button"
        onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: fallback }))}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sand focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Voltar"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      {title && <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>}
      {!title && <span className="flex-1" />}
      {action}
    </div>
  )
}
