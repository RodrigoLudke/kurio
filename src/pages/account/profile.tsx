import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChangePasswordRequest, UpdateProfileRequest } from '@/api/contracts'
import { errorMessage, toAppError } from '@/api/errors'
import { Field, focusFirstError, mergeFieldErrors, PasswordInput } from '@/components/form/field'
import { Avatar } from '@/components/layout/avatar'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { validatePasswordChange, validateProfile } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/queries/account'

type ProfileErrors = Partial<Record<keyof UpdateProfileRequest, string>>
type PasswordErrors = Partial<Record<keyof ChangePasswordRequest, string>>

const MAX_AVATAR = 512 * 1024

function AvatarEditor({ url, name }: { url: string | null; name: string }) {
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const onFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Use uma imagem PNG, JPG ou WebP.')
    if (file.size > MAX_AVATAR) return setError('A imagem deve ter no máximo 512 KB.')
    upload.mutate(file, {
      onSuccess: () => announce('Avatar atualizado.', { tone: 'success', toast: true }),
      onError: (e) => {
        const err = toAppError(e)
        setError(err.fieldErrors.avatar ?? err.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-3" role="group" aria-labelledby="avatar-label">
      <span id="avatar-label" className="text-sm font-medium">
        Avatar
      </span>
      <div className="flex items-center gap-6">
        <Avatar url={url} name={name} size={50} />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="avatar-file"
          aria-describedby={error ? 'avatar-error' : 'avatar-hint'}
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
          data-testid="avatar-input"
          tabIndex={-1}
        />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="h-10 px-6" data-testid="avatar-change">
          {upload.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Alterar
        </Button>
        <button
          type="button"
          onClick={() => remove.mutate(undefined, { onSuccess: () => announce('Avatar removido.', { tone: 'info' }), onError: (e) => setError(errorMessage(e)) })}
          disabled={!url || remove.isPending}
          className="text-sm hover:text-orange disabled:opacity-50"
        >
          Remover
        </button>
      </div>
      {error ? (
        <p id="avatar-error" role="alert" className="text-xs text-danger" data-testid="avatar-error">
          ⚠ {error}
        </p>
      ) : (
        <p id="avatar-hint" className="text-xs text-sand">
          PNG, JPG ou WebP até 512 KB.
        </p>
      )}
    </div>
  )
}

export function ProfilePage() {
  usePageTitle('Perfil do colecionador')
  const profile = useProfile()
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<UpdateProfileRequest>({ displayName: '', username: '', email: '', ensName: '', walletNickname: '' })
  const [passwords, setPasswords] = useState<ChangePasswordRequest>({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [pwErrors, setPwErrors] = useState<PasswordErrors>({})
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!profile.data) return
    const { displayName, username, email, ensName, walletNickname } = profile.data
    setValues({ displayName, username, email, ensName, walletNickname })
  }, [profile.data])

  const set = (key: keyof UpdateProfileRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
  }
  const setPw = (key: keyof ChangePasswordRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords((v) => ({ ...v, [key]: e.target.value }))
    setPwErrors((er) => ({ ...er, [key]: undefined }))
  }

  const wantsPassword = !!(passwords.currentPassword || passwords.newPassword || passwords.confirmPassword)
  const pending = update.isPending || changePassword.isPending

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    const local = validateProfile(values)
    const pwLocal = wantsPassword ? validatePasswordChange(passwords) : {}
    setErrors(local)
    setPwErrors(pwLocal)
    if (Object.keys(local).length || Object.keys(pwLocal).length) {
      setStatus({ tone: 'error', text: 'Revise os campos destacados.' })
      requestAnimationFrame(() => focusFirstError(formRef.current))
      return
    }
    const messages: string[] = []
    try {
      await update.mutateAsync(values)
      messages.push('Perfil salvo.')
    } catch (e) {
      const err = toAppError(e)
      setErrors(mergeFieldErrors<keyof UpdateProfileRequest>({}, err.fieldErrors))
      setStatus({ tone: 'error', text: err.message })
      requestAnimationFrame(() => focusFirstError(formRef.current))
      return
    }
    if (wantsPassword) {
      try {
        await changePassword.mutateAsync(passwords)
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
        messages.push('Senha alterada.')
      } catch (e) {
        const err = toAppError(e)
        setPwErrors(mergeFieldErrors<keyof ChangePasswordRequest>({}, err.fieldErrors))
        setStatus({ tone: 'error', text: `${messages.join(' ')} Não foi possível alterar a senha: ${err.message}` })
        requestAnimationFrame(() => focusFirstError(formRef.current))
        return
      }
    }
    setStatus({ tone: 'success', text: messages.join(' ') })
    announce(messages.join(' '), { tone: 'success', toast: true })
  }

  if (profile.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }
  if (profile.isError) {
    return (
      <Alert tone="error" className="flex-col items-start">
        {errorMessage(profile.error)}
        <Button size="sm" onClick={() => void profile.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    )
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-8" aria-labelledby="profile-title">
      <h1 id="profile-title" className="text-lg font-bold">
        Perfil do colecionador
      </h1>
      {status && (
        <Alert tone={status.tone} data-testid="profile-status">
          {status.text}
        </Alert>
      )}
      <div className="grid gap-x-7 gap-y-8 lg:grid-cols-2">
        <Field id="pf-displayName" label="Nome de exibição" required error={errors.displayName}>
          {(p) => <Input {...p} value={values.displayName} onChange={set('displayName')} autoComplete="name" />}
        </Field>
        <Field id="pf-username" label="Nome de usuário" required error={errors.username}>
          {(p) => <Input {...p} value={values.username} onChange={set('username')} autoComplete="username" />}
        </Field>
        <Field id="pf-email" label="E-mail" required error={errors.email}>
          {(p) => <Input {...p} type="email" value={values.email} onChange={set('email')} autoComplete="email" />}
        </Field>
        <Field id="pf-ensName" label="Nome ENS" required error={errors.ensName}>
          {(p) => (
            <div className="flex gap-2.5">
              <span className="flex h-10 shrink-0 items-center rounded-sm border border-line px-3 text-[15px]" aria-hidden="true">
                .eth
              </span>
              <Input {...p} value={values.ensName} onChange={set('ensName')} spellCheck={false} />
            </div>
          )}
        </Field>
        <Field id="pf-walletNickname" label="Apelido da carteira" required error={errors.walletNickname}>
          {(p) => <Input {...p} value={values.walletNickname} onChange={set('walletNickname')} />}
        </Field>
        <AvatarEditor url={profile.data.avatarUrl} name={profile.data.displayName} />
      </div>

      <fieldset className="flex max-w-[417px] flex-col gap-5">
        <legend className="mb-5 text-lg font-bold">Alterar senha</legend>
        <Field id="pf-current" label="Senha atual" error={pwErrors.currentPassword}>
          {(p) => <PasswordInput {...p} value={passwords.currentPassword} onChange={setPw('currentPassword')} autoComplete="current-password" />}
        </Field>
        <Field id="pf-new" label="Nova senha" error={pwErrors.newPassword} hint="Mínimo de 8 caracteres, com letras e números.">
          {(p) => <PasswordInput {...p} value={passwords.newPassword} onChange={setPw('newPassword')} autoComplete="new-password" />}
        </Field>
        <Field id="pf-confirm" label="Confirmar nova senha" error={pwErrors.confirmPassword}>
          {(p) => <PasswordInput {...p} value={passwords.confirmPassword} onChange={setPw('confirmPassword')} autoComplete="new-password" />}
        </Field>
      </fieldset>

      <Button type="submit" disabled={pending} className="h-10 w-[131px]" data-testid="profile-save">
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Salvar
      </Button>
    </form>
  )
}
