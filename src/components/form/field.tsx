import * as React from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  id: string
  label: React.ReactNode
  required?: boolean
  error?: string
  hint?: React.ReactNode
  className?: string
  /** esconde o rótulo visualmente (continua acessível) */
  srOnlyLabel?: boolean
  children: (control: { id: string; 'aria-invalid': boolean | undefined; 'aria-describedby': string | undefined; 'aria-required': boolean | undefined }) => React.ReactNode
}

/**
 * Campo de formulário acessível: rótulo associado, marcação de obrigatório
 * (texto + asterisco, não só cor) e mensagem de erro ligada por
 * aria-describedby e anunciada quando aparece.
 */
export function Field({ id, label, required, error, hint, className, srOnlyLabel, children }: FieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className={cn(srOnlyLabel && 'sr-only')}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-lg leading-none text-required">
              *
            </span>
            <span className="sr-only">(obrigatório)</span>
          </>
        )}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-sand">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-xs text-danger">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1.5 text-sand hover:text-orange focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        aria-controls={props.id}
      >
        {visible ? <EyeIcon className="size-4" aria-hidden="true" /> : <EyeOffIcon className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

/** Move o foco para o primeiro campo inválido após uma tentativa de envio. */
export function focusFirstError(form: HTMLFormElement | null) {
  const target = form?.querySelector<HTMLElement>('[aria-invalid="true"]')
  target?.focus()
}

/** Combina erros do cliente e erros por campo retornados pela API. */
export function mergeFieldErrors<T extends string>(
  local: Partial<Record<T, string>>,
  server: Record<string, string> | undefined,
  prefix = '',
): Partial<Record<T, string>> {
  const merged: Partial<Record<T, string>> = { ...local }
  for (const [key, message] of Object.entries(server ?? {})) {
    const field = (prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key) as T
    merged[field] = message
  }
  return merged
}
