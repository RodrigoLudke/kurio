import { Link, useNavigate } from '@tanstack/react-router'
import { RefreshCw, ShoppingCart, Trash2, TriangleAlert } from 'lucide-react'
import type { Cart, CartItem } from '@/api/contracts'
import { EDITION_LABEL } from '@/api/contracts'
import { errorMessage, toAppError } from '@/api/errors'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { QuantityStepper } from '@/components/quantity-stepper'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CouponForm, SummaryRows, SummarySkeleton } from '@/features/cart/cart-summary'
import { NftCarousel } from '@/features/nft/nft-carousel'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'
import { useAcknowledgeCart, useCart, useRemoveCartItem, useUpdateCartItem } from '@/queries/cart'
import { useCatalog } from '@/queries/catalog'

function LineNotice({ item }: { item: CartItem }) {
  if (item.status === 'ok') return null
  const text =
    item.status === 'price_changed'
      ? `Preço alterado: era ${formatEth(item.acknowledgedUnitPrice)}, agora ${formatEth(item.unitPrice)}.`
      : item.status === 'insufficient'
        ? `Restam apenas ${item.available} unidade(s). Ajuste a quantidade.`
        : 'Esta edição esgotou. Remova o item para continuar.'
  return (
    <p className="flex items-start gap-1.5 text-xs text-orange" data-testid={`line-status-${item.status}`}>
      <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

function useLineActions(item: CartItem) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const setQuantity = (quantity: number) =>
    update.mutate(
      { itemId: item.id, quantity },
      {
        onSuccess: () => announce(`Quantidade de ${item.nft.name} atualizada para ${quantity}.`),
        onError: (e) => announce(toAppError(e).message, { tone: 'error', toast: true }),
      },
    )
  const removeLine = () =>
    remove.mutate(item.id, {
      onSuccess: () => announce(`${item.nft.name} removido do carrinho.`, { tone: 'info', toast: true }),
      onError: (e) => announce(toAppError(e).message, { tone: 'error', toast: true }),
    })
  return { setQuantity, removeLine, busy: update.isPending || remove.isPending }
}

function CartRow({ item }: { item: CartItem }) {
  const { setQuantity, removeLine, busy } = useLineActions(item)
  const maxQ = Math.max(1, item.status === 'insufficient' ? item.quantity : item.maxQuantity)
  return (
    <li
      className={cn('grid grid-cols-[70px_1fr] items-center gap-x-4 gap-y-2 bg-surface md:grid-cols-[70px_minmax(0,1.4fr)_0.8fr_0.8fr_0.8fr_40px]', item.status === 'sold_out' && 'opacity-70')}
      data-testid="cart-line"
      aria-busy={busy}
    >
      <img src={item.nft.image.src.replace(/-\d+\.webp$/, '-128.webp')} alt="" width={70} height={70} className="size-[70px] object-cover" />
      <div className="flex min-w-0 flex-col gap-0.5 py-2 pr-3 md:pr-0">
        <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="truncate font-bold hover:text-orange">
          {item.nft.name}
        </Link>
        <span className="text-sm text-sand">ID do token: {item.nft.tokenId}</span>
        <span className="text-xs text-sand">Edição: {EDITION_LABEL[item.edition]}</span>
        <LineNotice item={item} />
      </div>
      <p className="col-start-2 text-[15px] md:col-start-auto">
        <span className="sr-only">Preço unitário: </span>
        {formatEth(item.unitPrice)}
      </p>
      <QuantityStepper
        className="col-start-2 md:col-start-auto"
        value={item.quantity}
        max={maxQ}
        onChange={setQuantity}
        label={item.nft.name}
        disabled={busy || item.status === 'sold_out'}
      />
      <p className="col-start-2 font-bold text-orange md:col-start-auto" data-testid="line-total">
        <span className="sr-only">Total da linha: </span>
        {formatEth(item.lineTotal)}
      </p>
      <button
        type="button"
        onClick={removeLine}
        disabled={busy}
        className="col-start-2 mb-3 flex size-9 items-center justify-center justify-self-start rounded-sm text-sand hover:text-orange focus-visible:ring-2 focus-visible:ring-ring md:col-start-auto md:mb-0 md:justify-self-center"
        aria-label={`Remover ${item.nft.name} do carrinho`}
        data-testid="remove-line"
      >
        <Trash2 className="size-5" aria-hidden="true" />
      </button>
    </li>
  )
}

function MobileCartCard({ item }: { item: CartItem }) {
  const { setQuantity, removeLine, busy } = useLineActions(item)
  const maxQ = Math.max(1, item.status === 'insufficient' ? item.quantity : item.maxQuantity)
  return (
    <li className="flex overflow-hidden rounded-xl bg-surface" data-testid="cart-line-mobile" aria-busy={busy}>
      <img src={item.nft.image.src.replace(/-\d+\.webp$/, '-128.webp')} alt="" width={100} height={100} className="size-[100px] shrink-0 object-cover" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
        <p className="truncate text-sm font-bold">{item.nft.name}</p>
        <p className="text-xs text-sand">Edição: {EDITION_LABEL[item.edition]}</p>
        <p className="text-base font-bold text-orange">{formatEth(item.lineTotal)}</p>
        <LineNotice item={item} />
      </div>
      <div className="flex flex-col items-center justify-center gap-2 pr-3">
        <QuantityStepper value={item.quantity} max={maxQ} onChange={setQuantity} label={item.nft.name} disabled={busy || item.status === 'sold_out'} />
        <button type="button" onClick={removeLine} disabled={busy} className="p-1 text-sand hover:text-orange" aria-label={`Remover ${item.nft.name} do carrinho`}>
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

function IssuesBanner({ cart }: { cart: Cart }) {
  const acknowledge = useAcknowledgeCart()
  const priceChanged = cart.items.filter((i) => i.status === 'price_changed')
  const blocked = cart.items.filter((i) => i.status === 'insufficient' || i.status === 'sold_out')
  if (!priceChanged.length && !blocked.length) return null
  return (
    <Alert tone="warning" className="flex-col gap-2" data-testid="cart-issues">
      <p className="flex items-center gap-2 font-bold">
        <TriangleAlert className="size-4 text-orange" aria-hidden="true" />
        Alguns itens mudaram desde que você os adicionou
      </p>
      {priceChanged.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sand">
          <span>
            {priceChanged.length === 1 ? `O preço de ${priceChanged[0]!.nft.name} foi atualizado.` : `${priceChanged.length} itens tiveram o preço atualizado.`} O resumo já reflete os novos valores.
          </span>
          <Button size="sm" variant="outline" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending} data-testid="acknowledge-prices">
            Entendi, manter itens
          </Button>
        </div>
      )}
      {blocked.length > 0 && <p className="text-sand">Ajuste ou remova os itens sem disponibilidade para finalizar a compra.</p>}
    </Alert>
  )
}

function CartBody({ cart, refreshing }: { cart: Cart; refreshing: boolean }) {
  const navigate = useNavigate()
  const blocked = cart.items.some((i) => i.status === 'insufficient' || i.status === 'sold_out')
  const needsAck = cart.items.some((i) => i.status === 'price_changed')
  const checkout = () => void navigate({ to: '/pagamento' })
  const disabledReason = blocked ? 'Ajuste os itens indisponíveis para continuar.' : needsAck ? 'Confirme os novos preços para continuar.' : null

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between">
        <section aria-labelledby="cart-items-title" className="flex flex-col gap-4">
          <h2 id="cart-items-title" className="sr-only">
            Itens do carrinho
          </h2>
          <IssuesBanner cart={cart} />
          <div className="hidden grid-cols-[70px_minmax(0,1.4fr)_0.8fr_0.8fr_0.8fr_40px] gap-x-4 border-b border-line pb-3 text-[15px] font-medium md:grid" aria-hidden="true">
            <span className="col-span-2">NFTs</span>
            <span>Preço</span>
            <span>Edições</span>
            <span>Total</span>
            <span />
          </div>
          <ul className="hidden flex-col gap-3 md:flex">
            {cart.items.map((item) => (
              <CartRow key={item.id} item={item} />
            ))}
          </ul>
          <ul className="flex flex-col gap-4 md:hidden">
            {cart.items.map((item) => (
              <MobileCartCard key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="summary-title" className="flex flex-col gap-5 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:rounded-t-3xl max-md:bg-surface max-md:px-5 max-md:pt-5 max-md:pb-5 max-md:shadow-[0_-8px_24px_rgb(0_0_0/0.4)]">
          <h2 id="summary-title" className="border-b border-line pb-3 text-lg font-bold max-md:sr-only">
            Resumo da carteira
          </h2>
          <div className="hidden md:block">
            <CouponForm cart={cart} />
          </div>
          <div className="md:hidden">
            <CouponForm cart={cart} variant="mobile" />
          </div>
          <div className={cn('transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
            <SummaryRows summary={cart.summary} />
          </div>
          {disabledReason && (
            <p className="text-xs text-orange" id="checkout-disabled-reason">
              {disabledReason}
            </p>
          )}
          <Button
            onClick={checkout}
            disabled={!!disabledReason || refreshing}
            aria-describedby={disabledReason ? 'checkout-disabled-reason' : undefined}
            className="h-10 w-full max-md:h-14 max-md:rounded-full max-md:bg-gradient-to-r max-md:from-[#e39a5b] max-md:to-[#c27c43] max-md:text-base"
            data-testid="checkout-button"
          >
            Conectar e finalizar
          </Button>
          <Link to="/mercado" className="hidden text-center text-[15px] text-orange hover:underline md:block">
            Continuar explorando
          </Link>
        </section>
      </div>
    </>
  )
}

function CartSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between" aria-busy="true" data-testid="cart-loading">
      <span className="sr-only" role="status">
        Carregando carrinho…
      </span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-full" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full" />
        ))}
      </div>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <SummarySkeleton />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

export function CartPage() {
  usePageTitle('Carrinho')
  const cart = useCart()
  const suggestions = useCatalog({ sort: 'recent', tab: 'all', page: 1, pageSize: 12 })
  const empty = cart.data && cart.data.items.length === 0

  return (
    <div className={cn(!empty && 'max-md:pb-[420px]')}>
      <MobileTopBar title="Carrinho de NFTs" fallback="/mercado" />
      <div className="container-kurio md:pt-6">
        <nav aria-label="Trilha de navegação" className="mb-2 hidden text-[15px] font-bold md:block">
          <Link to="/" className="hover:text-orange">Início</Link> <span aria-hidden="true">/</span>{' '}
          <Link to="/mercado" className="hover:text-orange">Mercado</Link> <span aria-hidden="true">/</span> <span aria-current="page">Carrinho</span>
        </nav>
        <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

        {cart.isPending ? (
          <CartSkeleton />
        ) : cart.isError && !cart.data ? (
          <Alert tone="error" className="flex-col items-start" data-testid="cart-error">
            <p className="font-bold">Não foi possível carregar seu carrinho.</p>
            <p className="text-sand">{errorMessage(cart.error)}</p>
            <Button size="sm" className="mt-2" onClick={() => void cart.refetch()}>
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </Alert>
        ) : empty ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center" data-testid="cart-empty">
            <ShoppingCart className="size-12 text-orange" aria-hidden="true" />
            <p className="text-xl font-bold">Seu carrinho está vazio</p>
            <p className="text-sand">Explore o mercado e adicione NFTs para começar sua coleção.</p>
            <Button asChild>
              <Link to="/mercado">Explorar o mercado</Link>
            </Button>
          </div>
        ) : cart.data ? (
          <CartBody cart={cart.data} refreshing={cart.isFetching} />
        ) : null}
      </div>
      <div className="max-md:hidden">
        <NftCarousel
          title="Colecionadores também viram"
          items={suggestions.data?.items.filter((n) => !cart.data?.items.some((i) => i.nftId === n.id)).slice(0, 10)}
          loading={suggestions.isPending}
        />
      </div>
    </div>
  )
}
