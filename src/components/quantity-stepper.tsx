import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  size?: 'lg' | 'sm'
  disabled?: boolean
  className?: string
}

/** Controle de quantidade inteira com limites (anuncia o valor via role=status). */
export function QuantityStepper({ value, min = 1, max, onChange, label, size = 'sm', disabled, className }: QuantityStepperProps) {
  const btn =
    size === 'lg'
      ? 'flex h-12 w-8 items-center justify-center rounded-full bg-brand text-kurio-bg disabled:bg-brand/40'
      : 'flex size-5 items-center justify-center rounded-full bg-brand text-kurio-bg disabled:bg-surface-2 disabled:text-sand'
  return (
    <div className={cn('flex items-center', size === 'lg' ? 'gap-4' : 'gap-3', className)} role="group" aria-label={label}>
      <button
        type="button"
        className={cn(btn, 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background')}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <Minus className={size === 'lg' ? 'size-5' : 'size-3'} strokeWidth={3} aria-hidden="true" />
      </button>
      <span className={cn('min-w-4 text-center tabular-nums', size === 'lg' ? 'text-xl' : 'text-base')} role="status" aria-live="polite" aria-label={`Quantidade: ${value}`}>
        {value}
      </span>
      <button
        type="button"
        className={cn(btn, 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background')}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <Plus className={size === 'lg' ? 'size-5' : 'size-3'} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}
