import * as React from 'react'
import { cn } from '@/lib/utils'

/** Skeleton do shadcn/ui com efeito shimmer (ver `.skeleton` em index.css). */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('skeleton', className)} {...props} />
}
