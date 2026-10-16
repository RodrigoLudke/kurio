import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toAppError } from '@/api/errors'
import { Field, focusFirstError, mergeFieldErrors, PasswordInput } from '@/components/form/field'
import { FacebookIcon, GoogleIcon } from '@/components/icons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { announce } from '@/lib/announce'
import { validateLogin, validateRegister } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'
import { HomePage } from '@/pages/home'
import { useLogin, useRegister } from '@/queries/session'

type Mode = 'login' | 'signup'

function SocialButtons({ onUnavailable }: { onUnavailable: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        Ou continue com
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        onClick={onUnavailable}
        className="flex h-10 items-center justify-center gap-2 rounded-sm border border-line text-xs hover:border-orange focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GoogleIcon className="size-5" /> Continuar com Google
      </button>
      <button
        type="button"
        onClick={onUnavailable}
        className="flex h-10 items-center justify-center gap-2 rounded-sm border border-line text-xs hover:border-orange focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FacebookIcon className="size-5 text-[#4e71ba]" /> Continuar com Facebook
      </button>
    </div>
  )
}

function AuthForm({ mode, redirect, reason }: { mode: Mode; redirect?: string; reason?: 'expirada' }) {
  const navigate = useNavigate()
  const login = useLogin()
  const register = useRegister()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const pending = login.isPending || register.isPending

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const done = () => {
    announce(mode === 'login' ? 'Você entrou na sua conta.' : 'Conta criada com sucesso. Bem-vindo à Kurio!', { tone: 'success', toast: true })
    void navigate({ to: redirect ?? '/', replace: true })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const local = mode === 'login' ? validateLogin(values) : validateRegister(values)
    setErrors(local)
    if (Object.keys(local).length) {
      requestAnimationFrame(() => focusFirstError(formRef.current))
      return
    }
    const onError = (error: unknown) => {
      const e = toAppError(error)
      const merged = mergeFieldErrors<keyof typeof values>({}, e.fieldErrors)
      setErrors(merged)
      if (!Object.keys(merged).length || e.code === 'INVALID_CREDENTIALS') setFormError(e.message)
      requestAnimationFrame(() => focusFirstError(formRef.current))
    }
    if (mode === 'login') login.mutate({ email: values.email, password: values.password }, { onSuccess: done, onError })
    else register.mutate(values, { onSuccess: done, onError })
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" aria-describedby={formError ? 'auth-form-error' : undefined}>
      {reason === 'expirada' && <Alert tone="warning">Sua sessão expirou. Entre novamente para continuar de onde parou.</Alert>}
      {formError && (
        <Alert tone="error" id="auth-form-error" data-testid="auth-error">
          {formError}
        </Alert>
      )}
      {mode === 'signup' && (
        <Field id="signup-username" label="Nome de usuário" srOnlyLabel error={errors.username}>
          {(p) => <Input {...p} value={values.username} onChange={set('username')} placeholder="Nome de usuário" autoComplete="username" className="text-center max-md:h-12 max-md:rounded-lg" />}
        </Field>
      )}
      <Field id={`${mode}-email`} label="E-mail" srOnlyLabel error={errors.email}>
        {(p) => <Input {...p} type="email" value={values.email} onChange={set('email')} placeholder={mode === 'login' ? 'contato@email.com' : 'Digite seu e-mail'} autoComplete="email" className="max-md:h-12 max-md:rounded-lg" />}
      </Field>
      <Field id={`${mode}-password`} label="Senha" srOnlyLabel error={errors.password}>
        {(p) => (
          <PasswordInput {...p} value={values.password} onChange={set('password')} placeholder="Senha" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="max-md:h-12 max-md:rounded-lg" />
        )}
      </Field>
      {mode === 'signup' && (
        <Field id="signup-confirm" label="Confirmar senha" srOnlyLabel error={errors.confirmPassword}>
          {(p) => <PasswordInput {...p} value={values.confirmPassword} onChange={set('confirmPassword')} placeholder="Confirmar senha" autoComplete="new-password" className="max-md:h-12 max-md:rounded-lg" />}
        </Field>
      )}
      {mode === 'login' && (
        <button
          type="button"
          className="self-end text-sm text-orange hover:underline"
          onClick={() => setNotice('A recuperação de senha ainda não está disponível nesta versão. Use as credenciais de demonstração do README.')}
        >
          Esqueceu a senha?
        </button>
      )}
      {notice && (
        <p role="status" className="text-xs text-sand">
          {notice}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2 h-11 text-base max-md:h-14 max-md:rounded-lg" data-testid="auth-submit">
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {mode === 'login' ? 'Entrar' : 'Criar perfil'}
      </Button>
      <SocialButtons onUnavailable={() => setNotice('Login social indisponível nesta demonstração. Entre com e-mail e senha.')} />
      {import.meta.env.VITE_ENABLE_MOCKS === 'true' && mode === 'login' && (
        <p className="text-center text-xs text-sand" data-testid="demo-credentials">
          Demo: <code>ana@kurio.dev</code> ou <code>bruno@kurio.dev</code> · senha <code>Kurio@2026</code>
        </p>
      )}
    </form>
  )
}

function AuthScreen({ mode }: { mode: Mode }) {
  const search = useSearch({ strict: false }) as { redirect?: string; motivo?: 'expirada' }
  const navigate = useNavigate()
  usePageTitle(mode === 'login' ? 'Entrar' : 'Criar conta')
  const close = () => void navigate({ to: search.redirect && !search.redirect.startsWith('/pagamento') && !search.redirect.startsWith('/conta') ? search.redirect : '/' })
  const tab = (target: Mode, label: string) =>
    target === mode ? (
      <span className="text-orange" aria-current="page">
        {label}
      </span>
    ) : (
      <Link to={target === 'login' ? '/entrar' : '/cadastro'} search={search} replace className="hover:text-orange">
        {label}
      </Link>
    )

  return (
    <>
      <div aria-hidden="true" inert className="max-md:hidden">
        <HomePage />
      </div>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent
          className={cn(
            'gap-6 px-6 py-10 sm:max-w-[500px] md:px-20',
            'max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:border-b-0 max-md:bg-background max-md:px-6',
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            document.getElementById(mode === 'login' ? 'login-email' : 'signup-username')?.focus()
          }}
        >
          <p className="mt-10 text-center text-4xl font-bold tracking-[0.18em] md:hidden" aria-hidden="true">
            KURIO
          </p>
          <div className="flex flex-col items-center gap-4 text-center max-md:mt-12">
            <DialogTitle className="hidden text-xl font-medium md:flex md:gap-2">
              {tab('login', 'Entrar')}
              <span aria-hidden="true" className="text-orange">
                |
              </span>
              {tab('signup', 'Criar conta')}
            </DialogTitle>
            <p className="text-xl font-bold md:hidden" aria-hidden="true">
              {mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}
            </p>
            <DialogDescription className="text-sm text-foreground">
              {mode === 'login'
                ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
                : 'Crie seu perfil de colecionador e comece uma coleção digital.'}
            </DialogDescription>
          </div>
          <AuthForm key={mode} mode={mode} redirect={search.redirect} reason={search.motivo} />
          <p className="text-center text-sm text-sand md:hidden">
            {mode === 'login' ? (
              <>
                Novo na Kurio?{' '}
                <Link to="/cadastro" search={search} className="text-orange">
                  Crie uma conta
                </Link>
              </>
            ) : (
              <>
                Já tem uma conta?{' '}
                <Link to="/entrar" search={search} className="text-orange">
                  Entre
                </Link>
              </>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function LoginPage() {
  return <AuthScreen mode="login" />
}

export function SignupPage() {
  return <AuthScreen mode="signup" />
}
