import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function Logo({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'lg' }) {
  return (
    <Link
      to="/"
      className={cn(
        'font-bold tracking-[0.12em] text-foreground hover:text-orange',
        size === 'sm' ? 'text-sm' : 'text-3xl tracking-[0.18em]',
        className,
      )}
      aria-label="Kurio — página inicial"
    >
      KURIO
    </Link>
  )
}
