import { Link } from '@tanstack/react-router'
import { errorMessage } from '@/api/errors'
import type { OrderStatus } from '@/api/contracts'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'
import { useOrders } from '@/queries/account'

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'border-orange text-orange' },
  confirmed: { label: 'Confirmado', className: 'border-success text-success' },
  declined: { label: 'Recusado', className: 'border-danger text-danger' },
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export function OrdersPage() {
  usePageTitle('Meus pedidos')
  const orders = useOrders()
  return (
    <section aria-labelledby="orders-title" className="flex flex-col gap-6">
      <h1 id="orders-title" className="text-lg font-bold">
        Atividade · Meus pedidos
      </h1>
      {orders.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : orders.isError ? (
        <Alert tone="error" className="flex-col items-start">
          {errorMessage(orders.error)}
          <Button size="sm" onClick={() => void orders.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      ) : orders.data.length === 0 ? (
        <p className="text-sand">
          Nenhum pedido ainda.{' '}
          <Link to="/mercado" className="text-orange hover:underline">
            Explore o mercado
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="orders-list">
          {orders.data.map((order) => (
            <li key={order.id}>
              <Link
                to="/pedidos/$orderId"
                params={{ orderId: order.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface p-4 hover:ring-1 hover:ring-orange focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex flex-col">
                  <span className="font-bold">{order.number}</span>
                  <span className="text-sm text-sand">
                    {dateFmt.format(new Date(order.createdAt))} · {order.items.reduce((s, i) => s + i.quantity, 0)} NFT(s)
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs', STATUS[order.status].className)}>{STATUS[order.status].label}</span>
                  <span className="font-bold text-orange">{formatEth(order.total)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
