import * as React from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="badge"
      className={cn('inline-flex items-center rounded-sm bg-brand px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-kurio-bg', className)}
      {...props}
    />
  )
}
