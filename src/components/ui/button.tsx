import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-brand-hover',
        outline: 'border border-brand bg-transparent text-orange hover:bg-brand/10',
        secondary: 'bg-surface-2 text-foreground hover:bg-line',
        ghost: 'text-foreground hover:bg-surface-2',
        link: 'text-orange underline-offset-4 hover:underline px-0',
        destructive: 'bg-destructive text-kurio-bg hover:bg-destructive/90',
      },
      size: {
        default: 'h-10 px-6',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
        pill: 'h-14 rounded-full px-8 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
