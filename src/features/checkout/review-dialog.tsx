import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Loader2, RefreshCw, TriangleAlert, Wallet as WalletIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EDITION_LABEL,
  NETWORK_LABEL,
  WALLET_PROVIDER_LABEL,
  type CollectorInfo,
  type CreateOrderRequest,
  type NetworkId,
  type Quote,
  type QuoteChange,
  type QuoteStaleDetails,
  type Wallet,
  type WalletProvider,
} from '@/api/contracts'
import { toAppError, type AppError } from '@/api/errors'
import { checkoutApi } from '@/api/endpoints'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SummaryRows } from '@/features/cart/cart-summary'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { randomId } from '@/lib/storage'
import { realtime } from '@/realtime/client'
import { useConnectWallet, useCreateOrder } from '@/queries/account'
import { keys } from '@/queries/keys'
import { loadAttempt, saveAttempt } from './storage'

type Phase =
  | { kind: 'connecting' }
  | { kind: 'quoting' }
  | { kind: 'ready' }
  | { kind: 'stale'; reason: string; changes: QuoteChange[]; freshQuote: Quote | null }
  | { kind: 'submitting'; slow: boolean }
  | { kind: 'error'; error: AppError; retry: 'connect' | 'quote' | 'submit' }

export interface ReviewInput {
  userId: string
  wallet: Wallet
  provider: WalletProvider
  network: NetworkId
  collector: CollectorInfo
  connected: boolean
}

function describeChange(change: QuoteChange) {
  switch (change.kind) {
    case 'price':
      return `${change.name} (${EDITION_LABEL[change.edition]}): ${formatEth(change.before)} → ${formatEth(change.after)}`
    case 'availability':
      return `${change.name}: quantidade ${change.before} → ${change.after}`
    case 'removed':
      return `${change.name} saiu do pedido`
    case 'coupon':
      return `Desconto: ${formatEth(change.before)} → ${formatEth(change.after)}`
    case 'fee':
      return `Taxa de rede: ${formatEth(change.before)} → ${formatEth(change.after)}`
  }
}

export function ReviewDialog({
  open,
  onOpenChange,
  input,
  onFieldErrors,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  input: ReviewInput | null
  onFieldErrors: (errors: Record<string, string>) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const connect = useConnectWallet()
  const createOrder = useCreateOrder()
  const [phase, setPhase] = useState<Phase>({ kind: 'quoting' })
  const [quote, setQuote] = useState<Quote | null>(null)
  const slowTimer = useRef<number | undefined>(undefined)
  const inputRef = useRef(input)
  inputRef.current = input

  const requestQuote = useCallback(async () => {
    const current = inputRef.current
    if (!current) return
    setPhase({ kind: 'quoting' })
    try {
      const next = await checkoutApi.quote({ network: current.network })
      setQuote(next)
      setPhase({ kind: 'ready' })
      announce(`Revisão pronta. Total: ${formatEth(next.total)}.`)
    } catch (error) {
      setPhase({ kind: 'error', error: toAppError(error), retry: 'quote' })
    }
  }, [])

  const prepare = useCallback(async () => {
    const current = inputRef.current
    if (!current) return
    if (!current.connected) {
      setPhase({ kind: 'connecting' })
      try {
        await connect.mutateAsync({ walletId: current.wallet.id, body: { provider: current.provider, network: current.network } })
        announce(`${WALLET_PROVIDER_LABEL[current.provider]} conectada na rede ${NETWORK_LABEL[current.network]}.`)
      } catch (error) {
        setPhase({ kind: 'error', error: toAppError(error), retry: 'connect' })
        return
      }
    }
    await requestQuote()
  }, [connect, requestQuote])

  // ao abrir: conecta (se preciso) e gera a cotação a ser revisada
  useEffect(() => {
    if (!open) return
    setQuote(null)
    void prepare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // tempo real: alteração em item da cotação invalida a confirmação
  useEffect(() => {
    if (!open || !quote) return
    const offNft = realtime.on('nft.updated', (event) => {
      const line = quote.lines.find((l) => l.nftId === event.data.nftId)
      if (!line) return
      setPhase((p) =>
        p.kind === 'submitting'
          ? p
          : {
              kind: 'stale',
              reason: `${event.data.name} foi atualizado (${event.data.changed.includes('price') ? 'preço' : 'disponibilidade'}) enquanto você revisava. Atualize a cotação antes de confirmar.`,
              changes: [],
              freshQuote: null,
            },
      )
    })
    const offWallet = realtime.on('wallet.updated', (event) => {
      if (event.data.walletId !== inputRef.current?.wallet.id || event.data.connection) return
      setPhase({
        kind: 'error',
        error: toAppError(new Error('A carteira foi desconectada. Conecte novamente para continuar.')),
        retry: 'connect',
      })
      if (inputRef.current) inputRef.current = { ...inputRef.current, connected: false }
    })
    return () => {
      offNft()
      offWallet()
    }
  }, [open, quote])

  useEffect(() => () => window.clearTimeout(slowTimer.current), [])

  const submit = () => {
    const current = inputRef.current
    if (!current || !quote) return
    const body: CreateOrderRequest = {
      quoteId: quote.id,
      walletId: current.wallet.id,
      provider: current.provider,
      network: current.network,
      collector: current.collector,
    }
    // reaproveita a chave se a mesma tentativa (mesma cotação e payload) já foi enviada
    const previous = loadAttempt(current.userId)
    const sameAttempt = previous && !previous.orderId && JSON.stringify(previous.body) === JSON.stringify(body)
    const attempt = sameAttempt ? previous : { idempotencyKey: randomId('ord'), body, orderId: null, createdAt: new Date().toISOString() }
    saveAttempt(current.userId, attempt)

    setPhase({ kind: 'submitting', slow: false })
    window.clearTimeout(slowTimer.current)
    slowTimer.current = window.setTimeout(() => setPhase((p) => (p.kind === 'submitting' ? { kind: 'submitting', slow: true } : p)), 4000)

    createOrder.mutate(
      { body: attempt.body, idempotencyKey: attempt.idempotencyKey },
      {
        onSuccess: (order) => {
          window.clearTimeout(slowTimer.current)
          saveAttempt(current.userId, { ...attempt, orderId: order.id })
          announce('Pedido enviado. Aguardando confirmação do pagamento.', { tone: 'info' })
          onOpenChange(false)
          void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
        },
        onError: (error) => {
          window.clearTimeout(slowTimer.current)
          const e = toAppError(error)
          if (e.code === 'QUOTE_STALE' || e.code === 'QUOTE_EXPIRED') {
            const details = e.details as QuoteStaleDetails | undefined
            saveAttempt(current.userId, null) // payload mudará: nova tentativa terá nova chave
            setPhase({ kind: 'stale', reason: e.message, changes: details?.changes ?? [], freshQuote: details?.quote ?? null })
            void queryClient.invalidateQueries({ queryKey: keys.cartAll() })
            announce(e.message, { tone: 'warning' })
            return
          }
          if (e.code === 'VALIDATION_ERROR') {
            saveAttempt(current.userId, null)
            onFieldErrors(e.fieldErrors)
            onOpenChange(false)
            return
          }
          if (e.code === 'AVAILABILITY_CONFLICT' || e.code === 'CART_HAS_ISSUES') {
            saveAttempt(current.userId, null)
            void queryClient.invalidateQueries({ queryKey: keys.cartAll() })
          }
          if (e.code === 'WALLET_NOT_CONNECTED' && inputRef.current) {
            saveAttempt(current.userId, null)
            inputRef.current = { ...inputRef.current, connected: false }
            setPhase({ kind: 'error', error: e, retry: 'connect' })
            return
          }
          setPhase({ kind: 'error', error: e, retry: e.retryable || e.kind === 'timeout' || e.kind === 'network' ? 'submit' : 'quote' })
        },
      },
    )
  }

  const acceptFresh = () => {
    if (phase.kind !== 'stale') return
    if (phase.freshQuote) {
      setQuote(phase.freshQuote)
      setPhase({ kind: 'ready' })
      announce(`Nova cotação: total ${formatEth(phase.freshQuote.total)}. Revise e confirme novamente.`)
    } else {
      void requestQuote()
    }
  }

  const retry = () => {
    if (phase.kind !== 'error') return
    if (phase.retry === 'connect') void prepare()
    else if (phase.retry === 'quote') void requestQuote()
    else submit()
  }

  const busy = phase.kind === 'connecting' || phase.kind === 'quoting' || phase.kind === 'submitting'

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && phase.kind === 'submitting' ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-xl gap-5 sm:max-w-xl" data-testid="review-dialog" onEscapeKeyDown={(e) => phase.kind === 'submitting' && e.preventDefault()}>
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription>Confira os valores atualizados antes de confirmar. A cotação é a referência final da compra.</DialogDescription>
        </div>

        {input && (
          <p className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm" data-testid="review-wallet">
            <WalletIcon className="size-4 text-orange" aria-hidden="true" />
            {input.wallet.nickname} · {WALLET_PROVIDER_LABEL[input.provider]} · {NETWORK_LABEL[input.network]}
            {phase.kind !== 'connecting' && phase.kind !== 'error' && <CircleCheck className="ml-auto size-4 text-success" aria-label="conectada" />}
          </p>
        )}

        <div aria-live="polite" className="flex flex-col gap-4">
          {phase.kind === 'connecting' && (
            <p className="flex items-center gap-2 text-sand" data-testid="review-connecting">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Solicitando conexão na carteira…
            </p>
          )}
          {phase.kind === 'quoting' && (
            <p className="flex items-center gap-2 text-sand">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Revalidando preços, disponibilidade, cupom e taxas…
            </p>
          )}
          {phase.kind === 'error' && (
            <Alert tone="error" className="flex-col items-start" data-testid="review-error">
              <p className="font-bold">
                {phase.error.code === 'WALLET_REJECTED' ? 'Conexão recusada' : phase.retry === 'submit' ? 'Não foi possível confirmar o envio do pedido' : 'Não foi possível continuar'}
              </p>
              <p className="text-sand">{phase.error.message}</p>
              {phase.retry === 'submit' && <p className="text-xs text-sand">Ao tentar novamente, reenviamos o mesmo pedido: nenhuma compra duplicada será criada.</p>}
              <Button size="sm" className="mt-2" onClick={retry} data-testid="review-retry">
                <RefreshCw aria-hidden="true" /> {phase.retry === 'connect' ? 'Conectar novamente' : 'Tentar novamente'}
              </Button>
            </Alert>
          )}
          {phase.kind === 'stale' && (
            <Alert tone="warning" className="flex-col items-start" data-testid="review-stale">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert className="size-4 text-orange" aria-hidden="true" /> Os valores mudaram
              </p>
              <p className="text-sand">{phase.reason}</p>
              {phase.changes.length > 0 && (
                <ul className="list-disc pl-5 text-sand">
                  {phase.changes.map((c, i) => (
                    <li key={i}>{describeChange(c)}</li>
                  ))}
                </ul>
              )}
              <Button size="sm" className="mt-2" onClick={acceptFresh} data-testid="review-refresh-quote">
                {phase.freshQuote ? 'Ver nova cotação' : 'Atualizar cotação'}
              </Button>
            </Alert>
          )}
        </div>

        {quote && (
          <div className="flex flex-col gap-4" data-testid="review-quote" aria-hidden={phase.kind === 'stale' ? true : undefined}>
            <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {quote.lines.map((line) => (
                <li key={`${line.nftId}:${line.edition}`} className="flex items-center gap-3 text-sm">
                  <img src={line.image.src.replace(/-\d+\.webp$/, '-128.webp')} alt="" width={40} height={40} className="size-10 rounded-md object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{line.name}</span>
                    <span className="text-xs text-sand">
                      {EDITION_LABEL[line.edition]} · {line.quantity} × {formatEth(line.unitPrice)}
                    </span>
                  </span>
                  <span className="font-bold text-orange">{formatEth(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <SummaryRows summary={quote} className={phase.kind === 'stale' ? 'opacity-50' : undefined} />
            {quote.coupon && <p className="text-xs text-sand">Cupom aplicado: {quote.coupon.code}</p>}
          </div>
        )}

        {phase.kind === 'submitting' && (
          <p className="flex items-center gap-2 text-sm text-sand" role="status" data-testid="review-submitting">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {phase.slow ? 'A rede está lenta. Verificando se o pedido foi criado — não feche esta janela.' : 'Enviando pedido…'}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={phase.kind === 'submitting'}>
            Voltar
          </Button>
          <Button onClick={submit} disabled={phase.kind !== 'ready' || !quote || busy} data-testid="confirm-order">
            {phase.kind === 'submitting' && <Loader2 className="animate-spin" aria-hidden="true" />}
            Confirmar e pagar {quote ? formatEth(quote.total) : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
