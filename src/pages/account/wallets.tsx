import { useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NETWORKS, NETWORK_LABEL, WALLET_PROVIDERS, WALLET_PROVIDER_LABEL, type Wallet, type WalletInput, type WalletSlot } from '@/api/contracts'
import { errorMessage, toAppError } from '@/api/errors'
import { Field, focusFirstError, mergeFieldErrors } from '@/components/form/field'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { validateWallet } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { useProfile, useSaveWallet, useWallets } from '@/queries/account'

type Errors = Partial<Record<keyof WalletInput | 'slot', string>>

const EMPTY: WalletInput = {
  displayName: '',
  nickname: '',
  network: '' as WalletInput['network'],
  profileName: '',
  address: '',
  secondaryAddress: '',
  provider: '' as WalletInput['provider'],
  referralCode: '',
  email: '',
  ensName: '',
}

function toInput(w: Wallet): WalletInput {
  const { id: _id, slot: _slot, updatedAt: _u, ...rest } = w
  void _id
  void _slot
  void _u
  return rest
}

function WalletForm({
  slot,
  wallet,
  defaults,
  onSaved,
  copyFrom,
}: {
  slot: WalletSlot
  wallet: Wallet | null
  defaults: Partial<WalletInput>
  onSaved: (w: Wallet) => void
  copyFrom?: Wallet | null
}) {
  const save = useSaveWallet()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<WalletInput>(() => (wallet ? toInput(wallet) : { ...EMPTY, ...defaults }))
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const p = `${slot}-`

  useEffect(() => {
    if (wallet) setValues(toInput(wallet))
  }, [wallet])

  const set = <K extends keyof WalletInput>(key: K, value: WalletInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const toggleSame = (checked: boolean) => {
    setSameAsPrimary(checked)
    if (checked && copyFrom) {
      // copia os dados de perfil da principal; endereço continua próprio
      const { address: _a, nickname: _n, secondaryAddress: _s, ...rest } = toInput(copyFrom)
      void _a
      void _n
      void _s
      setValues((v) => ({ ...v, ...rest }))
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    const local = validateWallet(values)
    setErrors(local)
    if (Object.keys(local).length) {
      requestAnimationFrame(() => focusFirstError(formRef.current))
      return
    }
    save.mutate(
      { id: wallet?.id ?? null, body: wallet ? values : { ...values, slot } },
      {
        onSuccess: (saved) => {
          setStatus({ tone: 'success', text: 'Carteira salva.' })
          announce(`Carteira ${saved.nickname} salva.`, { tone: 'success', toast: true })
          onSaved(saved)
        },
        onError: (error) => {
          const e = toAppError(error)
          setErrors(mergeFieldErrors<keyof WalletInput>({}, e.fieldErrors))
          setStatus({ tone: 'error', text: e.message })
          requestAnimationFrame(() => focusFirstError(formRef.current))
        },
      },
    )
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6" data-testid={`wallet-form-${slot}`}>
      {slot === 'secondary' && copyFrom && (
        <div className="flex items-center gap-2">
          <Checkbox id={`${p}same`} checked={sameAsPrimary} onCheckedChange={(c) => toggleSame(c === true)} />
          <Label htmlFor={`${p}same`} className="font-normal">
            Igual à carteira principal
          </Label>
        </div>
      )}
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <div className="grid gap-x-7 gap-y-7 lg:grid-cols-2">
        <Field id={`${p}displayName`} label="Nome de exibição" required error={errors.displayName}>
          {(a) => <Input {...a} value={values.displayName} onChange={(e) => set('displayName', e.target.value)} />}
        </Field>
        <Field id={`${p}nickname`} label="Apelido da carteira" required error={errors.nickname}>
          {(a) => <Input {...a} value={values.nickname} onChange={(e) => set('nickname', e.target.value)} />}
        </Field>
        <Field id={`${p}network`} label="Rede" required error={errors.network}>
          {(a) => (
            <Select value={values.network} onValueChange={(v) => set('network', v as WalletInput['network'])}>
              <SelectTrigger {...a}>
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
        <Field id={`${p}profileName`} label="Nome do perfil" required error={errors.profileName}>
          {(a) => <Input {...a} value={values.profileName} onChange={(e) => set('profileName', e.target.value)} />}
        </Field>
        <Field id={`${p}address`} label="Endereço da carteira" required error={errors.address}>
          {(a) => <Input {...a} value={values.address} onChange={(e) => set('address', e.target.value)} placeholder="Endereço 0x da carteira" spellCheck={false} />}
        </Field>
        <Field id={`${p}secondaryAddress`} label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress}>
          {(a) => <Input {...a} value={values.secondaryAddress} onChange={(e) => set('secondaryAddress', e.target.value)} placeholder="nome.eth ou 0x…" spellCheck={false} />}
        </Field>
        <Field id={`${p}provider`} label="Tipo de carteira" required error={errors.provider}>
          {(a) => (
            <Select value={values.provider} onValueChange={(v) => set('provider', v as WalletInput['provider'])}>
              <SelectTrigger {...a}>
                <SelectValue placeholder="Selecione uma carteira" />
              </SelectTrigger>
              <SelectContent>
                {WALLET_PROVIDERS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {WALLET_PROVIDER_LABEL[w]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field id={`${p}referralCode`} label="Código de indicação" required error={errors.referralCode}>
          {(a) => <Input {...a} value={values.referralCode} onChange={(e) => set('referralCode', e.target.value.toUpperCase())} />}
        </Field>
        <Field id={`${p}email`} label="E-mail" required error={errors.email}>
          {(a) => <Input {...a} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field id={`${p}ensName`} label="Nome ENS" required error={errors.ensName}>
          {(a) => (
            <div className="flex gap-2.5">
              <span className="flex h-10 shrink-0 items-center rounded-sm border border-line px-3 text-[15px]" aria-hidden="true">
                .eth
              </span>
              <Input {...a} value={values.ensName} onChange={(e) => set('ensName', e.target.value.toLowerCase())} spellCheck={false} />
            </div>
          )}
        </Field>
      </div>
      <Button type="submit" disabled={save.isPending} className="h-10 self-start px-1.5" data-testid={`wallet-save-${slot}`}>
        {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Salvar carteira
      </Button>
    </form>
  )
}

export function WalletsPage() {
  usePageTitle('Carteiras')
  const wallets = useWallets()
  const profile = useProfile()
  const search = useSearch({ from: '/conta/carteiras' })
  const navigate = useNavigate()
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [addingPrimary, setAddingPrimary] = useState(false)
  const primary = wallets.data?.find((w) => w.slot === 'primary') ?? null
  const secondary = wallets.data?.find((w) => w.slot === 'secondary') ?? null
  const defaults: Partial<WalletInput> = profile.data
    ? { displayName: profile.data.displayName, profileName: profile.data.username, email: profile.data.email, ensName: profile.data.ensName }
    : {}

  const afterSave = () => {
    if (search.redirect) void navigate({ to: search.redirect })
  }

  if (wallets.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }
  if (wallets.isError) {
    return (
      <Alert tone="error" className="flex-col items-start">
        {errorMessage(wallets.error)}
        <Button size="sm" onClick={() => void wallets.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-12">
      <h1 className="sr-only">Carteiras</h1>
      {search.redirect && <Alert tone="info">Depois de salvar, você volta automaticamente para o pagamento.</Alert>}
      <section aria-labelledby="primary-title" className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="primary-title" className="text-lg font-bold">
              Carteira principal
            </h2>
            <p className="text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && !addingPrimary && (
            <button type="button" className="text-lg font-bold text-orange hover:underline" onClick={() => setAddingPrimary(true)}>
              Adicionar
            </button>
          )}
        </div>
        {primary || addingPrimary ? (
          <WalletForm slot="primary" wallet={primary} defaults={defaults} onSaved={afterSave} />
        ) : (
          <p className="text-sm text-sand">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-lg font-bold">
              Carteira secundária
            </h2>
            {!secondary && !addingSecondary && <p className="text-sm text-sand">Você ainda não adicionou uma carteira secundária.</p>}
          </div>
          {!secondary && !addingSecondary && (
            <button
              type="button"
              className="text-lg font-bold text-orange hover:underline disabled:opacity-50"
              onClick={() => setAddingSecondary(true)}
              disabled={!primary}
              title={!primary ? 'Cadastre a carteira principal primeiro' : undefined}
              data-testid="add-secondary"
            >
              Adicionar
            </button>
          )}
        </div>
        {(secondary || addingSecondary) && <WalletForm slot="secondary" wallet={secondary} defaults={defaults} copyFrom={primary} onSaved={afterSave} />}
      </section>
    </div>
  )
}
