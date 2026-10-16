import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-sm border border-line bg-kurio-bg px-3 py-2 text-sm text-foreground transition-colors outline-none',
        'placeholder:text-subtle file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:border-orange focus-visible:ring-1 focus-visible:ring-orange',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger/60',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
