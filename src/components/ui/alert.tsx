import * as React from 'react'
import { cn } from '@/lib/utils'

export function Alert({
  className,
  tone = 'info',
  ...props
}: React.ComponentProps<'div'> & { tone?: 'info' | 'warning' | 'error' | 'success' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-slot="alert"
      data-tone={tone}
      className={cn(
        'relative flex w-full gap-3 rounded-md border px-4 py-3 text-sm',
        tone === 'info' && 'border-line bg-surface text-sand',
        tone === 'warning' && 'border-orange/60 bg-band/70 text-foreground',
        tone === 'error' && 'border-danger/70 bg-danger/10 text-foreground',
        tone === 'success' && 'border-success/60 bg-success/10 text-foreground',
        className,
      )}
      {...props}
    />
  )
}
