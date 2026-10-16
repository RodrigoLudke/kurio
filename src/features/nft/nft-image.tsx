import type { ImageAsset } from '@/api/contracts'
import { cn } from '@/lib/utils'

export function NftImage({
  image,
  sizes = '(min-width: 1024px) 260px, 45vw',
  className,
  priority = false,
  alt,
}: {
  image: ImageAsset
  sizes?: string
  className?: string
  priority?: boolean
  alt?: string
}) {
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={cn('aspect-square w-full bg-surface-2 object-cover', className)}
    />
  )
}
