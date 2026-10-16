import { Link, useParams, useSearch } from '@tanstack/react-router'
import { FlaskConical } from 'lucide-react'
import { NETWORK_LABEL } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { usePageTitle } from '@/lib/use-page-title'
import { useOrder } from '@/queries/account'

/** Explorador de blocos simulado: links de exploração do recibo apontam para cá. */
export function ExplorerPage() {
  const { hash } = useParams({ from: '/explorador/$hash' })
  const { pedido } = useSearch({ from: '/explorador/$hash' })
  const order = useOrder(pedido ?? 'desconhecido')
  usePageTitle('Explorador simulado')
  const block = parseInt(hash.slice(2, 9), 16) % 9_000_000 + 18_000_000

  return (
    <div className="container-kurio py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Alert tone="info">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden="true" />
          Explorador simulado: esta transação existe apenas no ambiente de demonstração da Kurio.
        </Alert>
        <h1 className="text-2xl font-bold">Detalhes da transação</h1>
        {order.isPending ? (
          <Skeleton className="h-64" />
        ) : order.isError || order.data.transactionHash !== hash ? (
          <Alert tone="error">{order.isError ? errorMessage(order.error) : 'Transação não encontrada para este pedido.'}</Alert>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 rounded-md bg-surface p-6 text-sm sm:grid-cols-[200px_1fr]">
            <dt className="text-sand">Hash da transação</dt>
            <dd className="font-mono break-all">{hash}</dd>
            <dt className="text-sand">Status</dt>
            <dd className="text-success">Sucesso</dd>
            <dt className="text-sand">Bloco</dt>
            <dd>{block.toLocaleString('pt-BR')}</dd>
            <dt className="text-sand">Rede</dt>
            <dd>{NETWORK_LABEL[order.data.network]}</dd>
            <dt className="text-sand">Para</dt>
            <dd className="font-mono break-all">{order.data.wallet.address}</dd>
            <dt className="text-sand">Valor</dt>
            <dd>{formatEth(order.data.total)}</dd>
            <dt className="text-sand">Tokens transferidos</dt>
            <dd>{order.data.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</dd>
          </dl>
        )}
        {pedido && (
          <Link to="/pedidos/$orderId" params={{ orderId: pedido }} className="text-orange hover:underline">
            ← Voltar ao recibo
          </Link>
        )}
      </div>
    </div>
  )
}
