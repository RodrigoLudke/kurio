import { Link, useParams } from '@tanstack/react-router'
import { CircleX, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { EDITION_LABEL, NETWORK_LABEL, WALLET_PROVIDER_LABEL, type Order } from '@/api/contracts'
import { errorMessage, toAppError } from '@/api/errors'
import { ThankYouIcon } from '@/components/icons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { clearDraft, loadAttempt, saveAttempt } from '@/features/checkout/storage'
import { announce } from '@/lib/announce'
import { formatEth, isZeroEth } from '@/lib/eth'
import { usePageTitle } from '@/lib/use-page-title'
import { realtime } from '@/realtime/client'
import { useOrder } from '@/queries/account'
import { useCurrentUser } from '@/queries/session'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const dateFmt = { format: (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}` }

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function Items({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-bold">Detalhes da transação</h2>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Itens do pedido {order.number}</caption>
        <thead>
          <tr className="border-b border-line text-[15px]">
            <th scope="col" className="pb-2 font-bold">NFTs</th>
            <th scope="col" className="px-2 pb-2 text-center font-bold">Edições</th>
            <th scope="col" className="pb-2 text-right font-bold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={`${item.nftId}:${item.edition}`} className="align-middle">
              <td className="py-2">
                <span className="flex items-center gap-3">
                  <img src={item.image.src.replace(/-\d+\.webp$/, '-128.webp')} alt="" width={66} height={66} className="size-11 shrink-0 rounded-lg object-cover sm:size-[66px]" />
                  <span className="min-w-0">
                    <span className="block font-bold">{item.name}</span>
                    <span className="block text-xs text-sand sm:text-sm">ID do token: {item.tokenId}</span>
                    <span className="block text-xs text-sand">
                      Edição {EDITION_LABEL[item.edition]} · {formatEth(item.unitPrice)} cada
                    </span>
                  </span>
                </span>
              </td>
              <td className="px-2 py-2 text-center whitespace-nowrap text-sand">(x {item.quantity})</td>
              <td className="py-2 text-right font-bold whitespace-nowrap text-orange sm:text-lg">{formatEth(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-[15px]">
        {!isZeroEth(order.discount) && (
          <div className="flex justify-between">
            <dt>Desconto{order.coupon ? ` (${order.coupon.code})` : ''}</dt>
            <dd>(-) {formatEth(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd className="text-lg" data-testid="receipt-fee">{formatEth(order.networkFee, { minDecimals: 3 })}</dd>
        </div>
        <div className="flex justify-between border-b border-line pb-2 font-bold">
          <dt>Total</dt>
          <dd className="text-lg text-orange" data-testid="receipt-total">
            {formatEth(order.total, { minDecimals: 3 })}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function Receipt({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-6" data-testid="receipt">
      <div className="flex flex-col items-center gap-3 text-center">
        <ThankYouIcon className="text-orange" />
        <h1 className="text-lg font-bold text-sand">Seus NFTs agora estão na sua carteira</h1>
      </div>
      <dl className="-mx-6 grid grid-cols-2 gap-y-3 border-y border-brand px-6 py-4 text-sm sm:-mx-10 sm:grid-cols-[1.35fr_1fr_1fr_1fr] sm:px-10">
        <div className="sm:border-r sm:border-line sm:pr-3">
          <dt className="font-bold text-sand">ID da transação</dt>
          <dd className="text-sand" data-testid="tx-hash">
            <span aria-hidden="true">{order.transactionHash ? shortHash(order.transactionHash) : '—'}</span>
            <span className="sr-only">{order.transactionHash}</span>
          </dd>
        </div>
        <div className="sm:border-r sm:border-line sm:px-3">
          <dt className="text-sand">Data</dt>
          <dd className="text-sand">{dateFmt.format(new Date(order.confirmedAt ?? order.createdAt))}</dd>
        </div>
        <div className="sm:border-r sm:border-line sm:px-3">
          <dt className="text-sand">Total</dt>
          <dd className="text-sand">{formatEth(order.total, { minDecimals: 3 })}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold text-sand">Carteira</dt>
          <dd className="text-sand">{WALLET_PROVIDER_LABEL[order.wallet.provider]}</dd>
        </div>
      </dl>
      <Items order={order} />
      <p className="text-center text-sm leading-relaxed text-sand">
        Transação confirmada na {NETWORK_LABEL[order.network]}. A propriedade foi transferida para sua carteira conectada ({order.wallet.label}) e registrada na rede. Pedido {order.number}.
      </p>
      {order.explorerUrl && (
        <Button asChild className="mx-auto h-12 px-5 text-base">
          <Link to="/explorador/$hash" params={{ hash: order.transactionHash! }} search={{ pedido: order.id }}>
            Ver no Etherscan <span className="sr-only">(explorador simulado)</span>
          </Link>
        </Button>
      )}
    </div>
  )
}

function Pending({ order }: { order: Order }) {
  const status = useSyncExternalStore(realtime.subscribeStatus, realtime.getStatus, realtime.getStatus)
  return (
    <div className="flex flex-col gap-6" data-testid="order-pending">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-12 animate-spin text-orange" aria-hidden="true" />
        <h1 className="text-xl font-bold">Aguardando confirmação do pagamento</h1>
        <p className="max-w-md text-sm text-sand">
          O pedido {order.number} foi registrado e está sendo confirmado na rede {NETWORK_LABEL[order.network]}. Você pode recarregar ou fechar esta página: o status será recuperado sem criar outra compra.
        </p>
        {status !== 'connected' && (
          <p className="text-xs text-orange">Sem conexão em tempo real no momento — verificando o status periodicamente.</p>
        )}
      </div>
      <Items order={order} />
    </div>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-6" data-testid="order-declined">
      <div className="flex flex-col items-center gap-3 text-center">
        <CircleX className="size-12 text-danger" aria-hidden="true" />
        <h1 className="text-xl font-bold">Pagamento recusado</h1>
        <p className="max-w-md text-sm text-sand">{order.declineReason}</p>
        <p className="max-w-md text-sm text-sand">Nenhum valor foi cobrado e seus itens continuam no carrinho.</p>
      </div>
      <Items order={order} />
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/pagamento">Tentar novamente</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </Button>
      </div>
    </div>
  )
}

export function OrderPage() {
  const { orderId } = useParams({ from: '/pedidos/$orderId' })
  const { userId } = useCurrentUser()
  const realtimeStatus = useSyncExternalStore(realtime.subscribeStatus, realtime.getStatus, realtime.getStatus)
  // com o socket fora do ar, o polling fica mais frequente
  const order = useOrder(orderId, { pollMs: realtimeStatus === 'connected' ? 8000 : 3000 })
  const lastStatus = useRef<string | null>(null)
  usePageTitle(order.data ? `Pedido ${order.data.number}` : 'Pedido')

  useEffect(() => {
    const data = order.data
    if (!data || !userId) return
    if (lastStatus.current && lastStatus.current !== data.status) {
      if (data.status === 'confirmed') announce('Pagamento confirmado! Seus NFTs estão na sua carteira.', { tone: 'success', toast: true })
      if (data.status === 'declined') announce('Pagamento recusado. Seus itens continuam no carrinho.', { tone: 'error', toast: true })
    }
    lastStatus.current = data.status
    if (data.status !== 'pending') {
      // estados terminais: encerra a tentativa salva
      const attempt = loadAttempt(userId)
      if (attempt?.orderId === data.id) saveAttempt(userId, null)
      if (data.status === 'confirmed') clearDraft(userId)
    }
  }, [order.data, userId])

  let body: React.ReactNode
  if (order.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only" role="status">
          Carregando pedido…
        </span>
        <Skeleton className="mx-auto size-20" />
        <Skeleton className="h-6 w-2/3 self-center" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  } else if (order.isError) {
    const e = toAppError(order.error)
    body = (
      <Alert tone="error" className="flex-col items-start" data-testid="order-error">
        <p className="font-bold">
          {e.status === 403 ? 'Acesso negado' : e.status === 404 ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}
        </p>
        <p className="text-sand">{errorMessage(e)}</p>
        {e.status !== 403 && e.status !== 404 && (
          <Button size="sm" className="mt-2" onClick={() => void order.refetch()}>
            <RefreshCw aria-hidden="true" /> Tentar novamente
          </Button>
        )}
      </Alert>
    )
  } else if (order.data.status === 'confirmed') {
    body = <Receipt order={order.data} />
  } else if (order.data.status === 'declined') {
    body = <Declined order={order.data} />
  } else {
    body = <Pending order={order.data} />
  }

  return (
    <div className="container-kurio py-8 md:py-12">
      <div className="mx-auto max-w-[580px] border-b-8 border-brand bg-surface px-6 py-8 sm:px-10" aria-live="polite">
        {body}
      </div>
      <p className="mt-6 text-center">
        <Link to="/conta/atividade" className="text-sm text-orange hover:underline">
          Ver todos os meus pedidos
        </Link>
      </p>
    </div>
  )
}
