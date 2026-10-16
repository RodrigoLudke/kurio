import { Loader2, Ticket, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Cart, PriceSummary } from '@/api/contracts'
import { toAppError } from '@/api/errors'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { formatEth, isZeroEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from '@/queries/cart'

export function SummaryRows({ summary, className, compact }: { summary: PriceSummary; className?: string; compact?: boolean }) {
  return (
    <dl className={cn('flex flex-col gap-3 text-[15px]', className)} data-testid="price-summary">
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd className="text-lg tabular-nums" data-testid="summary-subtotal">
          {formatEth(summary.subtotal)}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Desconto do lançamento</dt>
        <dd className="tabular-nums" data-testid="summary-discount">
          (-) {formatEth(summary.discount, { unit: !isZeroEth(summary.discount) })}
        </dd>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between gap-4">
          <dt>Taxa de rede</dt>
          <dd className="text-lg tabular-nums" data-testid="summary-fee">
            {formatEth(summary.networkFee, { minDecimals: 3 })}
          </dd>
        </div>
        {summary.feeEstimated && <p className={cn('text-right text-xs text-orange', compact && 'text-center')}>Taxa estimada</p>}
      </div>
      <div className="mt-2 flex justify-between gap-4 border-t border-line pt-4 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-orange tabular-nums" data-testid="summary-total">
          {formatEth(summary.total, { minDecimals: 3 })}
        </dd>
      </div>
    </dl>
  )
}

export function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true" data-testid="summary-loading">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

export function CouponForm({ cart, variant = 'desktop' }: { cart: Cart; variant?: 'desktop' | 'mobile' }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = `coupon-${variant}`

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim()) {
      setError('Digite um código promocional.')
      return
    }
    setError(null)
    apply.mutate(code, {
      onSuccess: (next) => {
        setCode('')
        announce(`Cupom ${next.coupon?.code} aplicado. Novo total: ${formatEth(next.summary.total)}.`, { tone: 'success' })
      },
      onError: (e) => {
        const appError = toAppError(e)
        setError(appError.fieldErrors.code ?? appError.message)
      },
    })
  }

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-brand/60 bg-band/50 px-3 py-2 text-sm" data-testid="coupon-applied">
        <span className="flex items-center gap-2">
          <Ticket className="size-4 text-orange" aria-hidden="true" />
          <span>
            <strong className="text-orange">{cart.coupon.code}</strong> — {cart.coupon.description}
          </span>
        </span>
        <button
          type="button"
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => announce('Cupom removido.', { tone: 'info' }),
              onError: (e) => announce(toAppError(e).message, { tone: 'error', toast: true }),
            })
          }
          disabled={remove.isPending}
          className="rounded-sm p-1 text-orange hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Remover cupom ${cart.coupon.code}`}
        >
          {remove.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={inputId} className={cn('text-sm font-bold', variant === 'mobile' && 'sr-only')}>
        Código promocional
      </label>
      <div className={cn('flex overflow-hidden', variant === 'mobile' ? 'rounded-full border border-line-strong bg-kurio-bg' : 'rounded-sm border border-brand')}>
        <input
          id={inputId}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-transparent px-3 text-xs text-foreground uppercase placeholder:text-subtle placeholder:normal-case focus-visible:outline-2 focus-visible:-outline-offset-2"
          data-testid="coupon-input"
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className={cn('flex items-center gap-1 bg-brand px-5 text-sm font-bold text-kurio-bg hover:bg-brand-hover disabled:opacity-70', variant === 'mobile' && 'rounded-full')}
        >
          {apply.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Aplicar
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-danger" data-testid="coupon-error">
          ⚠ {error}
        </p>
      )}
    </form>
  )
}
