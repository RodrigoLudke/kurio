import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Heart, Mail, RefreshCw, Search, ShoppingCart, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EDITION_LABEL, NETWORK_LABEL, type Edition, type NftDetail } from '@/api/contracts'
import { errorMessage, toAppError } from '@/api/errors'
import { LinkedinIcon, XTwitterIcon } from '@/components/icons'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { QuantityStepper } from '@/components/quantity-stepper'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FavoriteIconButton, useFavoriteToggle } from '@/features/nft/favorite-button'
import { NftCarousel } from '@/features/nft/nft-carousel'
import { NftImage } from '@/features/nft/nft-image'
import { announce } from '@/lib/announce'
import { compareEth, formatEth, mulEth } from '@/lib/eth'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'
import { useAddToCart, useCart } from '@/queries/cart'
import { useNft, useRelated } from '@/queries/catalog'

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-1 text-orange', className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3.5', i < Math.round(rating) ? 'fill-current' : 'opacity-40')} />
      ))}
    </span>
  )
}

function pickInitialEdition(nft: NftDetail): Edition | undefined {
  return nft.editions.find((e) => e.type === nft.defaultEdition && e.available > 0) ?? nft.editions.find((e) => e.available > 0)
}

function DetailSkeleton() {
  return (
    <div className="container-kurio pt-6" aria-busy="true" data-testid="detail-loading">
      <span className="sr-only" role="status">
        Carregando NFT…
      </span>
      <Skeleton className="mb-4 hidden h-5 w-40 md:block" />
      <div className="grid gap-8 md:grid-cols-[minmax(0,572px)_1fr]">
        <div className="flex gap-7">
          <div className="hidden flex-col gap-4 lg:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-[100px]" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full max-w-[444px]" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-1/2" />
        </div>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="container-kurio flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center" data-testid="nft-not-found">
      <MobileTopBar className="self-stretch" />
      <p className="text-5xl font-bold text-orange">404</p>
      <h1 className="text-2xl font-bold">NFT não encontrado</h1>
      <p className="max-w-md text-sand">Este NFT não existe ou foi removido do mercado. Confira outras obras disponíveis.</p>
      <Button asChild>
        <Link to="/mercado">Explorar o mercado</Link>
      </Button>
    </div>
  )
}

function useLivePriceNotice(nft: NftDetail | undefined) {
  const previous = useRef<{ id: string; price: string; version: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!nft) return
    const prev = previous.current
    if (prev && prev.id === nft.id && nft.version > prev.version && compareEth(prev.price, nft.price) !== 0) {
      setNotice(`Preço atualizado agora: de ${formatEth(prev.price)} para ${formatEth(nft.price)}.`)
    }
    previous.current = { id: nft.id, price: nft.price, version: nft.version }
  }, [nft])
  return notice
}

function Detail({ nft }: { nft: NftDetail }) {
  usePageTitle(nft.name)
  const navigate = useNavigate()
  const related = useRelated(nft.id)
  const cart = useCart()
  const addToCart = useAddToCart()
  const favorite = useFavoriteToggle(nft.id, nft.name)
  const [selected, setSelected] = useState<Edition['type'] | undefined>(() => pickInitialEdition(nft)?.type)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const notice = useLivePriceNotice(nft)

  // reseta seleção ao trocar de NFT
  useEffect(() => {
    setSelected(pickInitialEdition(nft)?.type)
    setQuantity(1)
    setActiveImage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nft.id])

  const edition = nft.editions.find((e) => e.type === selected)
  const inCart = cart.data?.items.find((i) => i.nftId === nft.id && i.edition === selected)?.quantity ?? 0
  const maxQuantity = Math.max(0, (edition?.maxPerOrder ?? 0) - inCart)
  const unavailable = !edition || edition.available === 0
  const limitReached = !unavailable && maxQuantity === 0

  // mantém a quantidade dentro do limite quando a disponibilidade muda em tempo real
  useEffect(() => {
    if (maxQuantity > 0 && quantity > maxQuantity) setQuantity(maxQuantity)
    if (maxQuantity === 0 && quantity !== 1) setQuantity(1)
  }, [maxQuantity, quantity])

  const unitPrice = edition?.price ?? nft.price
  const total = useMemo(() => mulEth(unitPrice, Math.max(1, quantity)), [unitPrice, quantity])

  const add = (thenGoToCart: boolean) => {
    if (!edition || unavailable || limitReached) return
    addToCart.mutate(
      { nftId: nft.id, edition: edition.type, quantity },
      {
        onSuccess: () => {
          announce(`${quantity}× ${nft.name} (edição ${EDITION_LABEL[edition.type]}) adicionado ao carrinho.`, { tone: 'success', toast: true })
          if (thenGoToCart) void navigate({ to: '/carrinho' })
        },
        onError: (error) => announce(toAppError(error).message, { tone: 'error', toast: true }),
      },
    )
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const share = [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, Icon: LinkedinIcon },
    { label: 'e-mail', href: `mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(shareUrl)}`, Icon: Mail },
    { label: 'X (Twitter)', href: `https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(nft.name)}`, Icon: XTwitterIcon },
  ]

  const image = nft.gallery[activeImage] ?? nft.image
  const statusText = unavailable
    ? 'Edição indisponível no momento.'
    : limitReached
      ? `Você já tem o limite desta edição no carrinho (${edition.maxPerOrder}).`
      : `Máx. ${maxQuantity} por pedido · ${edition.supply === null ? 'edição aberta' : `${edition.available} disponível(is)`}`

  return (
    <div className="pb-36 md:pb-0">
      <MobileTopBar action={<FavoriteIconButton nftId={nft.id} nftName={nft.name} className="bg-surface-2" />} fallback="/mercado" />
      <div className="container-kurio md:pt-6">
        <nav aria-label="Trilha de navegação" className="mb-3 hidden text-[15px] font-bold md:block">
          <Link to="/" className="hover:text-orange">
            Início
          </Link>{' '}
          <span aria-hidden="true">/</span>{' '}
          <Link to="/mercado" className="hover:text-orange">
            Mercado
          </Link>
        </nav>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[572px_1fr] lg:gap-8">
          {/* Galeria */}
          <div className="flex items-start gap-7">
            <ul className="hidden shrink-0 flex-col gap-4 lg:flex" aria-label="Galeria">
              {nft.gallery.map((img, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                    aria-current={i === activeImage ? 'true' : undefined}
                    className={cn('block size-[100px] overflow-hidden rounded-md border-2 focus-visible:ring-2 focus-visible:ring-ring', i === activeImage ? 'border-brand' : 'border-transparent')}
                  >
                    <img src={img.src.replace(/-\d+\.webp$/, '-128.webp')} alt="" width={100} height={100} className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative w-full max-w-[444px] bg-surface p-0 max-md:mx-auto max-md:max-w-none md:p-5">
              <NftImage image={image} priority sizes="(min-width: 768px) 404px, 100vw" className="rounded-[20px] max-md:rounded-[24px]" />
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="absolute top-2 right-2 hidden size-9 items-center justify-center rounded-full bg-kurio-bg text-foreground hover:text-orange focus-visible:ring-2 focus-visible:ring-ring md:flex"
                aria-label="Ampliar imagem"
              >
                <Search className="size-5" aria-hidden="true" />
              </button>
              <div className="mt-3 flex justify-center gap-2 lg:hidden" role="group" aria-label="Galeria">
                {nft.gallery.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                    aria-current={i === activeImage ? 'true' : undefined}
                    className="flex size-6 items-center justify-center"
                  >
                    <span className={cn('size-2 rounded-full border border-brand', i === activeImage && 'bg-brand')} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Informações */}
          <div className="flex flex-col gap-4 max-md:-mt-2 max-md:rounded-t-3xl max-md:bg-surface max-md:px-4 max-md:pt-6">
            <div className="flex items-start justify-between gap-3 md:block">
              <h1 className="text-xl font-bold tracking-wide md:text-[28px]" data-testid="nft-name">
                {nft.name}
              </h1>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-sm md:hidden">
                <Star className="size-3.5 fill-orange text-orange" aria-hidden="true" />
                {nft.rating.toFixed(1)}
                <span className="text-sand">({nft.reviewCount})</span>
                <span className="sr-only">avaliações</span>
              </span>
            </div>
            <div className="hidden items-center justify-between gap-4 border-b border-line pb-3 md:flex">
              <p className="text-[22px] font-bold text-orange" data-testid="nft-price">
                {formatEth(unitPrice)}
              </p>
              <p className="flex items-center gap-2 text-[15px]">
                <Stars rating={nft.rating} />
                <span>
                  <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5, </span>
                  {nft.reviewCount} avaliações de colecionadores
                </span>
              </p>
            </div>
            {notice && (
              <Alert tone="warning" data-testid="price-notice">
                <RefreshCw className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden="true" />
                {notice}
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <h2 className="text-[15px] font-bold max-md:sr-only">Sobre este NFT:</h2>
              <p className="text-sm leading-[1.75] text-sand">{nft.description}</p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[15px] font-bold">Edição:</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Edição">
                {nft.editions.map((e) => {
                  const active = e.type === selected
                  const soldOut = e.available === 0
                  return (
                    <button
                      key={e.type}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-disabled={soldOut}
                      onClick={() => {
                        if (soldOut) {
                          announce(`A edição ${EDITION_LABEL[e.type]} está esgotada.`)
                          return
                        }
                        setSelected(e.type)
                        setQuantity(1)
                      }}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                        active ? 'border-brand font-bold text-orange' : 'border-line-strong text-sand hover:border-orange',
                        soldOut && 'cursor-not-allowed line-through opacity-50 hover:border-line-strong',
                      )}
                      data-testid={`edition-${e.type}`}
                    >
                      {EDITION_LABEL[e.type]}
                      <span className="sr-only">
                        {soldOut ? ' — esgotada' : ` — ${formatEth(e.price)}`}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className={cn('text-xs', unavailable || limitReached ? 'text-danger' : 'text-sand')} data-testid="edition-status" aria-live="polite">
                {statusText}
              </p>
            </fieldset>

            <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
              <QuantityStepper value={quantity} max={Math.max(1, maxQuantity)} onChange={setQuantity} label={nft.name} size="lg" disabled={unavailable || limitReached} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => add(true)} disabled={unavailable || limitReached || addToCart.isPending} className="h-10 w-[130px]" data-testid="buy-button">
                  COMPRAR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => add(false)}
                  disabled={unavailable || limitReached || addToCart.isPending}
                  size="icon"
                  aria-label="Adicionar ao carrinho"
                  data-testid="add-to-cart"
                >
                  <ShoppingCart aria-hidden="true" />
                </Button>
                <Button variant="outline" onClick={favorite.onToggle} aria-pressed={favorite.isFavorite} className="h-10 px-3 font-medium text-orange" data-testid="favorite-toggle">
                  <Heart className={cn('size-5', favorite.isFavorite && 'fill-current')} aria-hidden="true" />
                  {favorite.isFavorite ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>
            {quantity > 1 && <p className="hidden text-sm text-sand md:block">Subtotal: {formatEth(total)}</p>}

            <dl className="flex flex-col gap-2 text-[15px] text-sand">
              <div className="flex gap-2">
                <dt>ID do token:</dt>
                <dd>{nft.tokenId}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Coleção:</dt>
                <dd>{nft.collectionName}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Atributos:</dt>
                <dd>{nft.attributes.join(', ')}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Rede:</dt>
                <dd>{NETWORK_LABEL[nft.network]}</dd>
              </div>
            </dl>
            <div className="hidden items-center gap-3 text-[15px] font-bold md:flex">
              Compartilhar este NFT:
              <ul className="flex items-center gap-2">
                {share.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a href={href} target={href.startsWith('mailto') ? undefined : '_blank'} rel="noopener noreferrer" className="flex text-foreground hover:text-orange">
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="sr-only">Compartilhar por {label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <Tabs defaultValue="details" className="mt-12 md:mt-20">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
            <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewCount})</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="flex flex-col gap-5 text-sm leading-[1.75] text-sand">
            {nft.longDescription.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <div>
              <h3 className="font-bold text-foreground">Rede:</h3>
              <p>Cunhado na {NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">Contrato:</h3>
              <p>Direitos autorais do criador: {nft.royaltiesPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">Direitos autorais:</h3>
              <p>
                {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)} · Contrato inteligente {nft.standard} verificado.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="reviews">
            <p className="mb-4 text-sm text-sand">
              Exibindo {nft.reviews.length} de {nft.reviewCount} avaliações.
            </p>
            <ul className="flex flex-col gap-4">
              {nft.reviews.map((r) => (
                <li key={r.id} className="rounded-md bg-surface p-4">
                  <p className="flex items-center gap-3 text-sm font-bold">
                    {r.author}
                    <Stars rating={r.rating} />
                    <span className="sr-only">nota {r.rating} de 5</span>
                  </p>
                  <p className="mt-2 text-sm text-sand">{r.comment}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </div>

      <NftCarousel title="Mais desta coleção" items={related.data?.items} loading={related.isPending} />

      {/* Barra de compra fixa (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl bg-surface px-4 pt-4 pb-5 shadow-[0_-8px_24px_rgb(0_0_0/0.4)] md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-sand" aria-hidden="true">
              Qtd.
            </span>
            <QuantityStepper value={quantity} max={Math.max(1, maxQuantity)} onChange={setQuantity} label={nft.name} disabled={unavailable || limitReached} />
          </div>
          <p className="text-xl font-bold text-orange">{formatEth(total)}</p>
        </div>
        <div className="flex gap-3">
          <Button size="pill" className="flex-1 bg-gradient-to-r from-[#e39a5b] to-[#c27c43]" onClick={() => add(true)} disabled={unavailable || limitReached || addToCart.isPending}>
            Comprar NFT
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-14 rounded-full text-orange"
            onClick={() => add(false)}
            disabled={unavailable || limitReached || addToCart.isPending}
            aria-label="Adicionar ao carrinho"
          >
            <ShoppingCart className="size-6" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-2xl border-b-4 p-4">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">{image.alt}</DialogDescription>
          <img src={image.src} alt={image.alt} width={image.width} height={image.height} className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const query = useNft(nftId)
  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    const error = toAppError(query.error)
    if (error.status === 404) return <NotFound />
    return (
      <div className="container-kurio py-16">
        <Alert tone="error" className="flex-col items-start" data-testid="detail-error">
          <p className="font-bold">Não foi possível carregar este NFT.</p>
          <p className="text-sand">{errorMessage(error)}</p>
          <Button size="sm" className="mt-2" onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden="true" /> Tentar novamente
          </Button>
        </Alert>
      </div>
    )
  }
  return <Detail nft={query.data} />
}
