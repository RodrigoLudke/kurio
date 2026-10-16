import * as React from 'react'
import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-32 w-full rounded-sm border border-line bg-kurio-bg px-3 py-2 text-sm text-foreground outline-none placeholder:text-subtle',
        'focus-visible:border-orange focus-visible:ring-1 focus-visible:ring-orange aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
