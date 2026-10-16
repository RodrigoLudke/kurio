import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Avatar({ url, name, size = 48, className }: { url: string | null; name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 text-orange', className)}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={name ? `Avatar de ${name}` : 'Avatar'} width={size} height={size} className="size-full object-cover" />
      ) : initials ? (
        <span aria-hidden="true" className="text-xs font-bold">
          {initials}
        </span>
      ) : (
        <ImageIcon className="size-1/2" aria-hidden="true" />
      )}
    </span>
  )
}
