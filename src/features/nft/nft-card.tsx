import { Link } from '@tanstack/react-router'
import { Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { toAppError } from '@/api/errors'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useAddToCart } from '@/queries/cart'
import { FavoriteIconButton } from './favorite-button'
import { NftImage } from './nft-image'

export function PriceLine({ price, compareAt, className }: { price: string; compareAt?: string | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 text-base', className)}>
      <span className="font-bold text-orange">{formatEth(price)}</span>
      {compareAt && (
        <>
          <span className="sr-only">preço anterior</span>
          <s className="text-sand">{formatEth(compareAt)}</s>
        </>
      )}
    </p>
  )
}

export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const addToCart = useAddToCart()
  const soldOut = nft.available === 0

  const quickAdd = () => {
    addToCart.mutate(
      { nftId: nft.id, edition: nft.defaultEdition, quantity: 1 },
      {
        onSuccess: () => announce(`${nft.name} (edição ${nft.defaultEdition}) adicionado ao carrinho.`, { tone: 'success', toast: true }),
        onError: (error) => announce(toAppError(error).message, { tone: 'error', toast: true }),
      },
    )
  }

  return (
    <article className={cn('group relative flex flex-col gap-3', className)} data-testid="nft-card" aria-labelledby={`nft-${nft.id}-title`}>
      <div className="relative bg-surface p-1 max-md:rounded-2xl md:pb-5">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} tabIndex={-1} aria-hidden="true" className="block">
          <NftImage image={nft.image} priority={priority} className="rounded-2xl md:rounded-[14px]" />
        </Link>
        {nft.badge && (
          <Badge className="absolute top-1 left-1 rounded-none rounded-br-sm px-3 py-1.5 text-sm font-medium normal-case md:left-1">
            {nft.badge === 'raro' ? 'RARO' : 'NOVO'}
          </Badge>
        )}
        {/* mobile: coração sempre visível */}
        <FavoriteIconButton nftId={nft.id} nftName={nft.name} className="absolute top-3 right-3 z-10 size-8 md:hidden" />
        {/* desktop: ações aparecem no hover/foco */}
        <div className="absolute inset-x-0 bottom-1 z-10 hidden justify-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
          <button
            type="button"
            onClick={quickAdd}
            disabled={soldOut || addToCart.isPending}
            className="flex size-9 items-center justify-center rounded-sm bg-kurio-bg text-foreground hover:text-orange focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={soldOut ? `${nft.name} esgotado` : `Adicionar ${nft.name} ao carrinho`}
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
          </button>
          <FavoriteIconButton nftId={nft.id} nftName={nft.name} className="rounded-sm bg-kurio-bg text-foreground hover:text-orange" />
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="flex size-9 items-center justify-center rounded-sm bg-kurio-bg text-foreground hover:text-orange focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver detalhes de ${nft.name}`}
          >
            <Search className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 px-2 md:px-0">
        <h3 id={`nft-${nft.id}-title`} className="text-[15px] font-normal tracking-wide">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-orange focus-visible:outline-none">
            {nft.name}
          </Link>
        </h3>
        <PriceLine price={nft.price} compareAt={nft.compareAtPrice} />
        {soldOut && <p className="text-xs text-danger">Esgotado</p>}
      </div>
    </article>
  )
}

export function NftCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-hidden="true" data-testid="nft-card-skeleton">
      <div className="bg-surface p-1 max-md:rounded-2xl md:pb-5">
        <Skeleton className="aspect-square w-full rounded-2xl md:rounded-[14px]" />
      </div>
      <div className="flex flex-col gap-2 px-2 md:px-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}
