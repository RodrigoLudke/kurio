import { Link, useNavigate } from '@tanstack/react-router'
import { EllipsisVertical, Loader2, RefreshCw, TriangleAlert, Unplug } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  EDITION_LABEL,
  NETWORKS,
  NETWORK_LABEL,
  WALLET_PROVIDERS,
  WALLET_PROVIDER_LABEL,
  type CollectorInfo,
  type NetworkId,
  type Wallet,
  type WalletProvider,
} from '@/api/contracts'
import { errorMessage, toAppError } from '@/api/errors'
import { Field, focusFirstError, mergeFieldErrors } from '@/components/form/field'
import { WalletBrands } from '@/components/layout/footer'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { SummaryRows, SummarySkeleton } from '@/features/cart/cart-summary'
import { ReviewDialog, type ReviewInput } from '@/features/checkout/review-dialog'
import { loadAttempt, loadDraft, saveDraft } from '@/features/checkout/storage'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { validateCollector } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'
import { useDisconnectWallet, useProfile, useWalletConnection, useWallets } from '@/queries/account'
import { useCartForNetwork } from '@/queries/cart'
import { useCurrentUser } from '@/queries/session'

interface FormState extends CollectorInfo {
  network: NetworkId | ''
  provider: WalletProvider | ''
  walletId: string
  useOtherWallet: boolean
}

type Errors = Partial<Record<keyof FormState, string>>

const EMPTY: FormState = {
  displayName: '',
  username: '',
  profileName: '',
  email: '',
  walletAddress: '',
  secondaryAddress: '',
  referralCode: '',
  ensName: '',
  note: '',
  network: '',
  provider: '',
  walletId: '',
  useOtherWallet: false,
}

function fromWallet(wallet: Wallet): Partial<FormState> {
  return {
    walletId: wallet.id,
    walletAddress: wallet.address,
    secondaryAddress: wallet.secondaryAddress,
    network: wallet.network,
    provider: wallet.provider,
    referralCode: wallet.referralCode,
    profileName: wallet.profileName,
    ensName: wallet.ensName,
  }
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function ProviderIcon({ provider }: { provider: WalletProvider }) {
  const letter = provider === 'walletconnect' ? 'W' : provider === 'metamask' ? 'M' : 'C'
  return (
    <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-band text-xs font-bold text-orange">
      {letter}
    </span>
  )
}

export function CheckoutPage() {
  usePageTitle('Pagamento')
  const navigate = useNavigate()
  const { userId } = useCurrentUser()
  const profile = useProfile()
  const wallets = useWallets()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [hydrated, setHydrated] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  // no mobile os dados do colecionador ficam recolhidos (o layout mobile prioriza carteira e rede)
  const [detailsOpen, setDetailsOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches)
  const [reviewInput, setReviewInput] = useState<ReviewInput | null>(null)
  const network: NetworkId = values.network || 'ethereum'
  const cart = useCartForNetwork(network)
  const connection = useWalletConnection(values.walletId || null)
  const disconnect = useDisconnectWallet()

  // retoma pedido em andamento (refresh/queda de conexão durante o envio)
  const pendingAttempt = useMemo(() => (userId ? loadAttempt(userId) : null), [userId])
  useEffect(() => {
    if (pendingAttempt?.orderId) void navigate({ to: '/pedidos/$orderId', params: { orderId: pendingAttempt.orderId }, replace: true })
  }, [pendingAttempt, navigate])

  // pré-preenche com perfil + carteira principal e aplica o rascunho salvo
  useEffect(() => {
    if (hydrated || !userId || !profile.data || !wallets.data) return
    const primary = wallets.data.find((w) => w.slot === 'primary') ?? wallets.data[0]
    const base: FormState = {
      ...EMPTY,
      displayName: profile.data.displayName,
      username: profile.data.username,
      email: profile.data.email,
      ensName: profile.data.ensName,
      ...(primary ? fromWallet(primary) : {}),
    }
    const draft = loadDraft<FormState>(userId)
    setValues({ ...base, ...(draft ?? {}) })
    setHydrated(true)
  }, [hydrated, userId, profile.data, wallets.data])

  useEffect(() => {
    if (hydrated && userId) saveDraft(userId, values)
  }, [hydrated, userId, values])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const selectWallet = (walletId: string) => {
    const wallet = wallets.data?.find((w) => w.id === walletId)
    if (!wallet) return
    setValues((v) => ({ ...v, ...fromWallet(wallet) }))
    announce(`Carteira ${wallet.nickname} selecionada.`)
  }

  const selectedWallet = wallets.data?.find((w) => w.id === values.walletId) ?? null
  const isConnected =
    !!connection.data && connection.data.provider === values.provider && connection.data.network === values.network

  const validateAll = (): Errors => {
    const local: Errors = { ...validateCollector(values) }
    if (!values.network) local.network = 'Selecione uma rede.'
    if (!values.provider) local.provider = 'Selecione uma carteira.'
    if (!values.walletId) local.walletId = 'Cadastre ou selecione uma carteira.'
    return local
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const local = validateAll()
    setErrors(local)
    if (Object.keys(local).length) {
      announce(`Revise ${Object.keys(local).length} campo(s) do formulário.`, { tone: 'error' })
      requestAnimationFrame(() => focusFirstError(formRef.current))
      return
    }
    if (!selectedWallet || !userId) return
    const { network: n, provider, walletId: _w, useOtherWallet: _u, ...collector } = values
    void _w
    void _u
    setReviewInput({ userId, wallet: selectedWallet, provider: provider as WalletProvider, network: n as NetworkId, collector, connected: isConnected })
    setReviewOpen(true)
  }

  const applyServerErrors = (fieldErrors: Record<string, string>) => {
    const merged = mergeFieldErrors<keyof FormState>({}, fieldErrors, 'collector.')
    setErrors(merged)
    announce('O servidor recusou alguns dados. Revise os campos destacados.', { tone: 'error' })
    requestAnimationFrame(() => focusFirstError(formRef.current))
  }

  const loadError = profile.error ?? wallets.error
  const loading = !hydrated && !loadError
  const noWallets = wallets.data && wallets.data.length === 0
  const cartData = cart.data
  const cartIssues = cartData?.items.some((i) => i.status === 'sold_out' || i.status === 'insufficient')
  const priceChanged = cartData?.items.filter((i) => i.status === 'price_changed') ?? []
  const emptyCart = cartData && cartData.items.length === 0
  const blockReason = emptyCart ? 'Seu carrinho está vazio.' : cartIssues ? 'Há itens sem disponibilidade. Ajuste o carrinho para continuar.' : noWallets ? 'Cadastre uma carteira para continuar.' : null

  const providerRadios = (idPrefix: string) => (
    <RadioGroup
      value={values.provider}
      onValueChange={(v) => set('provider', v as WalletProvider)}
      aria-label="Carteira para pagamento"
      aria-invalid={errors.provider ? true : undefined}
      className="gap-3"
    >
      {WALLET_PROVIDERS.map((p) => (
        <Label
          key={p}
          htmlFor={`${idPrefix}-${p}`}
          className={cn(
            'flex h-14 cursor-pointer items-center gap-4 rounded-md border bg-transparent px-4 text-[15px] font-normal max-md:rounded-xl max-md:border-0 max-md:bg-surface',
            values.provider === p ? 'border-foreground' : 'border-line',
          )}
        >
          <RadioGroupItem id={`${idPrefix}-${p}`} value={p} className="md:order-first max-md:order-last max-md:ml-auto" />
          <span className="hidden max-md:inline">
            <ProviderIcon provider={p} />
          </span>
          {p === 'walletconnect' ? (
            <>
              <WalletBrands className="max-md:hidden" />
              <span className="md:sr-only">WalletConnect</span>
            </>
          ) : (
            WALLET_PROVIDER_LABEL[p]
          )}
        </Label>
      ))}
    </RadioGroup>
  )

  return (
    <div className="max-md:pb-32">
      <MobileTopBar title="Pagamento com carteira" fallback="/carrinho" />
      <div className="container-kurio md:pt-6">
        <nav aria-label="Trilha de navegação" className="mb-6 hidden text-[15px] font-bold md:block">
          <Link to="/" className="hover:text-orange">Início</Link> <span aria-hidden="true">/</span>{' '}
          <Link to="/mercado" className="hover:text-orange">Mercado</Link> <span aria-hidden="true">/</span> <span aria-current="page">Pagamento</span>
        </nav>
        <h1 className="sr-only max-md:hidden">Pagamento</h1>

        {pendingAttempt && !pendingAttempt.orderId && (
          <Alert tone="warning" className="mb-6 flex-col items-start" data-testid="pending-attempt">
            <p className="font-bold">Há um envio de pedido não confirmado</p>
            <p className="text-sand">
              Sua última tentativa pode ter sido criada antes de a conexão cair. Ao revisar e confirmar novamente com os mesmos dados, recuperamos o mesmo pedido — sem cobrança duplicada.
            </p>
          </Alert>
        )}
        {loadError && (
          <Alert tone="error" className="mb-6 flex-col items-start">
            <p>{errorMessage(loadError)}</p>
            <Button size="sm" onClick={() => void Promise.all([profile.refetch(), wallets.refetch()])}>
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </Alert>
        )}
        {priceChanged.length > 0 && (
          <Alert tone="warning" className="mb-6" data-testid="checkout-price-changed">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden="true" />
            <span>
              {priceChanged.map((i) => `${i.nft.name}: ${formatEth(i.acknowledgedUnitPrice)} → ${formatEth(i.unitPrice)}`).join(' · ')}. O resumo foi atualizado; você confirmará os novos valores na revisão.
            </span>
          </Alert>
        )}

        <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between" aria-describedby={blockReason ? 'checkout-block' : undefined}>
          {/* Coluna esquerda: dados do colecionador */}
          <section aria-labelledby="collector-title" className="order-2 flex flex-col gap-5 md:order-1">
            {/* Mobile: carteiras cadastradas */}
            <div className="flex flex-col gap-3 md:hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Carteira conectada</h2>
                <Link to="/conta/carteiras" search={{ redirect: '/pagamento' }} className="text-sm font-bold text-orange">
                  Trocar carteira
                </Link>
              </div>
              <RadioGroup value={values.walletId} onValueChange={selectWallet} aria-label="Carteira de recebimento" className="gap-4">
                {(wallets.data ?? []).map((w) => (
                  <Label key={w.id} htmlFor={`m-wallet-${w.id}`} className="flex cursor-pointer items-center gap-4 rounded-xl bg-surface p-4 font-normal">
                    <RadioGroupItem id={`m-wallet-${w.id}`} value={w.id} />
                    <span className="flex flex-1 flex-col gap-1">
                      <span className="font-bold">{w.nickname}</span>
                      <span className="text-sm text-sand">{w.secondaryAddress || shortAddress(w.address)}</span>
                      <span className="text-sm text-sand">Rede {w.slot === 'primary' ? 'principal ' : ''}{NETWORK_LABEL[w.network]}</span>
                    </span>
                    <EllipsisVertical className="size-4 text-sand" aria-hidden="true" />
                  </Label>
                ))}
              </RadioGroup>
              <h2 className="mt-2 text-base font-bold">Carteira e rede</h2>
              {providerRadios('m-provider')}
            </div>

            <details
              className="group md:contents"
              open={detailsOpen || Object.keys(errors).some((k) => errors[k as keyof FormState])}
              onToggle={(e) => setDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer list-none rounded-md bg-surface px-4 py-3 font-bold md:hidden">
                Dados do colecionador <span className="text-xs font-normal text-sand">(toque para revisar)</span>
              </summary>
              <div className="flex flex-col gap-5 max-md:mt-4">
                <h2 id="collector-title" className="text-lg font-bold max-md:sr-only">
                  Perfil do colecionador
                </h2>
                {loading ? (
                  <div className="grid gap-5 md:grid-cols-2" aria-busy="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                    <Field id="co-displayName" label="Nome de exibição" required error={errors.displayName}>
                      {(p) => <Input {...p} value={values.displayName} onChange={(e) => set('displayName', e.target.value)} autoComplete="name" />}
                    </Field>
                    <Field id="co-username" label="Nome de usuário" required error={errors.username}>
                      {(p) => <Input {...p} value={values.username} onChange={(e) => set('username', e.target.value)} autoComplete="username" />}
                    </Field>
                    <Field id="co-network" label="Rede" required error={errors.network}>
                      {(p) => (
                        <Select value={values.network} onValueChange={(v) => set('network', v as NetworkId)}>
                          <SelectTrigger {...p}>
                            <SelectValue placeholder="Selecione uma rede" />
                          </SelectTrigger>
                          <SelectContent>
                            {NETWORKS.map((n) => (
                              <SelectItem key={n} value={n}>
                                {NETWORK_LABEL[n]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    <Field id="co-profileName" label="Nome do perfil" required error={errors.profileName}>
                      {(p) => <Input {...p} value={values.profileName} onChange={(e) => set('profileName', e.target.value)} />}
                    </Field>
                    <Field id="co-walletAddress" label="Endereço da carteira" required error={errors.walletAddress}>
                      {(p) => <Input {...p} value={values.walletAddress} onChange={(e) => set('walletAddress', e.target.value)} placeholder="Endereço 0x da carteira" spellCheck={false} className="pl-5" />}
                    </Field>
                    <Field id="co-secondaryAddress" label={<span className="max-md:inline md:invisible">ENS ou carteira secundária (opcional)</span>} error={errors.secondaryAddress}>
                      {(p) => (
                        <Input {...p} aria-label="ENS ou carteira secundária (opcional)" value={values.secondaryAddress} onChange={(e) => set('secondaryAddress', e.target.value)} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} className="pl-5" />
                      )}
                    </Field>
                    <Field id="co-provider" label="Tipo de carteira" required error={errors.provider}>
                      {(p) => (
                        <Select value={values.provider} onValueChange={(v) => set('provider', v as WalletProvider)}>
                          <SelectTrigger {...p}>
                            <SelectValue placeholder="Selecione uma carteira" />
                          </SelectTrigger>
                          <SelectContent>
                            {WALLET_PROVIDERS.map((wp) => (
                              <SelectItem key={wp} value={wp}>
                                {WALLET_PROVIDER_LABEL[wp]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    <Field id="co-referralCode" label="Código de indicação" required error={errors.referralCode}>
                      {(p) => <Input {...p} value={values.referralCode} onChange={(e) => set('referralCode', e.target.value.toUpperCase())} />}
                    </Field>
                    <Field id="co-email" label="E-mail" required error={errors.email}>
                      {(p) => <Input {...p} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />}
                    </Field>
                    <Field id="co-ensName" label="Nome ENS" required error={errors.ensName}>
                      {(p) => (
                        <div className="flex gap-2">
                          <Input {...p} value={values.ensName} onChange={(e) => set('ensName', e.target.value.toLowerCase())} spellCheck={false} />
                          <span className="flex h-10 shrink-0 items-center rounded-sm border border-line px-3 text-[15px]" aria-hidden="true">
                            .eth
                          </span>
                        </div>
                      )}
                    </Field>
                  </div>
                )}

                {!loading && (
                  <>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="co-other" checked={values.useOtherWallet} onCheckedChange={(c) => set('useOtherWallet', c === true)} />
                    <Label htmlFor="co-other" className="font-normal">
                      Usar outra carteira?
                    </Label>
                  </div>
                  {values.useOtherWallet && (
                    <div className="flex flex-col gap-2 rounded-md border border-line p-4">
                      <p className="text-sm text-sand" id="other-wallet-desc">
                        Escolha entre suas carteiras cadastradas. Os dados do formulário serão atualizados.
                      </p>
                      <RadioGroup value={values.walletId} onValueChange={selectWallet} aria-describedby="other-wallet-desc">
                        {(wallets.data ?? []).map((w) => (
                          <div key={w.id} className="flex items-center gap-3">
                            <RadioGroupItem id={`d-wallet-${w.id}`} value={w.id} />
                            <Label htmlFor={`d-wallet-${w.id}`} className="font-normal">
                              {w.nickname} · {shortAddress(w.address)} · {NETWORK_LABEL[w.network]}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      <Link to="/conta/carteiras" search={{ redirect: '/pagamento' }} className="text-sm text-orange hover:underline">
                        Gerenciar carteiras
                      </Link>
                    </div>
                  )}
                  {errors.walletId && (
                    <p role="alert" className="text-xs text-danger">
                      ⚠ {errors.walletId}{' '}
                      <Link to="/conta/carteiras" search={{ redirect: '/pagamento' }} className="underline">
                        Cadastrar carteira
                      </Link>
                    </p>
                  )}
                </div>

                <Field id="co-note" label="Observação do colecionador (opcional)" error={errors.note} className="max-w-[350px]">
                  {(p) => <Textarea {...p} value={values.note} onChange={(e) => set('note', e.target.value)} rows={6} maxLength={500} />}
                </Field>
                  </>
                )}
              </div>
            </details>
          </section>

          {/* Coluna direita: resumo, carteira e rede */}
          <section aria-labelledby="order-summary-title" className="order-1 flex flex-col gap-4 md:order-2">
            <div className="hidden flex-col gap-2 md:flex">
              <h2 id="order-summary-title" className="text-lg font-bold">
                Seus NFTs
              </h2>
              <div className="flex justify-between border-b border-line pb-2 text-[15px] font-medium" aria-hidden="true">
                <span>NFTs</span>
                <span>Subtotal</span>
              </div>
              {cart.isPending ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-[70px]" />
                  ))}
                </div>
              ) : (
                <ul className="flex flex-col gap-3" data-testid="checkout-lines">
                  {cartData?.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 bg-surface pr-4">
                      <img src={item.nft.image.src.replace(/-\d+\.webp$/, '-128.webp')} alt="" width={70} height={70} className="size-[70px] object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{item.nft.name}</span>
                        <span className="block truncate text-sm text-sand">ID do token: {item.nft.tokenId}</span>
                        <span className="block text-xs text-sand">Edição {EDITION_LABEL[item.edition]}</span>
                      </span>
                      <span className="text-sm text-sand">(x {item.quantity})</span>
                      <span className="text-lg font-bold text-orange">{formatEth(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-center text-sm">
                Tem um código promocional?{' '}
                <Link to="/carrinho" className="text-orange hover:underline">
                  Aplique aqui
                </Link>
              </p>
            </div>

            <div aria-busy={cart.isFetching} data-testid="checkout-summary" className="max-md:hidden">
              {cartData ? <SummaryRows summary={cartData.summary} compact /> : <SummarySkeleton />}
            </div>

            <div className="hidden flex-col gap-3 md:flex">
              <h2 className="text-center text-lg font-bold">Carteira e rede</h2>
              {providerRadios('d-provider')}
              {errors.provider && <p className="text-xs text-danger">⚠ {errors.provider}</p>}
            </div>

            {selectedWallet && connection.data && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-sand" data-testid="wallet-connection">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                Conectada: {selectedWallet.nickname} · {WALLET_PROVIDER_LABEL[connection.data.provider]} · {NETWORK_LABEL[connection.data.network]}
                <button
                  type="button"
                  onClick={() =>
                    disconnect.mutate(selectedWallet.id, {
                      onSuccess: () => announce('Carteira desconectada.', { tone: 'info' }),
                      onError: (e) => announce(toAppError(e).message, { tone: 'error', toast: true }),
                    })
                  }
                  className="inline-flex items-center gap-1 text-orange hover:underline"
                >
                  <Unplug className="size-3.5" aria-hidden="true" /> Desconectar
                </button>
              </p>
            )}

            {blockReason && (
              <Alert tone="warning" id="checkout-block">
                <span>
                  {blockReason}{' '}
                  {noWallets ? (
                    <Link to="/conta/carteiras" search={{ redirect: '/pagamento' }} className="text-orange underline">
                      Cadastrar carteira
                    </Link>
                  ) : (
                    <Link to="/carrinho" className="text-orange underline">
                      Ir para o carrinho
                    </Link>
                  )}
                </span>
              </Alert>
            )}

            <div className="flex flex-col gap-3 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:bg-background max-md:px-5 max-md:pt-3 max-md:pb-5">
              <p className="flex items-center justify-end gap-6 text-lg font-bold md:hidden">
                Total: <span className="text-orange">{cartData ? formatEth(cartData.summary.total, { minDecimals: 3 }) : '—'}</span>
              </p>
              <Button
                type="submit"
                disabled={!!blockReason || loading || reviewOpen}
                className="h-11 w-full text-base max-md:h-14 max-md:rounded-full max-md:bg-gradient-to-r max-md:from-[#e39a5b] max-md:to-[#c27c43]"
                data-testid="checkout-submit"
              >
                {reviewOpen && <Loader2 className="animate-spin" aria-hidden="true" />}
                Confirmar compra
              </Button>
            </div>
          </section>
        </form>
      </div>

      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} input={reviewInput} onFieldErrors={applyServerErrors} />
    </div>
  )
}
