/**
 * Regras de validação compartilhadas entre formulários (feedback imediato)
 * e servidor simulado (fonte da verdade). Retornam mensagens em português
 * ou `null` quando o valor é válido.
 */
import { NETWORKS, WALLET_PROVIDERS, type NetworkId, type WalletProvider } from '@/api/contracts'

export type Validator = (value: string) => string | null

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME = /^[a-z0-9._]{3,20}$/
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS_LABEL = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/
const ENS_FULL = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/
const REFERRAL = /^[A-Za-z0-9-]{4,20}$/

export const rules = {
  required(label: string): Validator {
    return (v) => (v.trim() ? null : `Informe ${label}.`)
  },
  email: (v: string) => (!v.trim() ? 'Informe seu e-mail.' : EMAIL.test(v.trim()) ? null : 'Informe um e-mail válido.'),
  username: (v: string) =>
    !v.trim()
      ? 'Informe o nome de usuário.'
      : USERNAME.test(v.trim())
        ? null
        : 'Use de 3 a 20 caracteres: letras minúsculas, números, ponto ou sublinhado.',
  displayName: (v: string) => {
    const t = v.trim()
    if (!t) return 'Informe o nome de exibição.'
    if (t.length < 2 || t.length > 40) return 'O nome de exibição deve ter de 2 a 40 caracteres.'
    return null
  },
  password: (v: string) => {
    if (!v) return 'Informe a senha.'
    if (v.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'A senha deve combinar letras e números.'
    return null
  },
  address: (v: string) =>
    !v.trim() ? 'Informe o endereço da carteira.' : ADDRESS.test(v.trim()) ? null : 'Use um endereço 0x com 40 caracteres hexadecimais.',
  optionalSecondary: (v: string) => {
    const t = v.trim()
    if (!t) return null
    return ADDRESS.test(t) || ENS_FULL.test(t.toLowerCase()) ? null : 'Use um nome ENS (ex.: nome.eth) ou um endereço 0x.'
  },
  ensName: (v: string) => {
    const t = v.trim().toLowerCase().replace(/\.eth$/, '')
    if (!t) return 'Informe o nome ENS.'
    return ENS_LABEL.test(t) && t.length <= 40 ? null : 'Use letras minúsculas, números, hífen ou ponto.'
  },
  optionalEnsName: (v: string) => {
    const t = v.trim().toLowerCase().replace(/\.eth$/, '')
    if (!t) return null
    return ENS_LABEL.test(t) && t.length <= 40 ? null : 'Use letras minúsculas, números, hífen ou ponto.'
  },
  referral: (v: string) =>
    !v.trim() ? 'Informe o código de indicação.' : REFERRAL.test(v.trim()) ? null : 'Use de 4 a 20 letras, números ou hífen.',
  network: (v: string) => (NETWORKS.includes(v as NetworkId) ? null : 'Selecione uma rede.'),
  provider: (v: string) => (WALLET_PROVIDERS.includes(v as WalletProvider) ? null : 'Selecione uma carteira.'),
  shortText(label: string, max: number): Validator {
    return (v) => {
      const t = v.trim()
      if (!t) return `Informe ${label}.`
      return t.length > max ? `Use no máximo ${max} caracteres.` : null
    }
  },
  maxLength(max: number): Validator {
    return (v) => (v.length > max ? `Use no máximo ${max} caracteres.` : null)
  },
}

/** Aplica um mapa de validadores e retorna apenas os campos com erro. */
export function validate<T extends object>(
  values: T,
  schema: Partial<Record<keyof T & string, Validator>>,
): Partial<Record<keyof T & string, string>> {
  const errors: Partial<Record<keyof T & string, string>> = {}
  for (const key of Object.keys(schema) as (keyof T & string)[]) {
    const validator = schema[key]
    if (!validator) continue
    const raw = (values as Record<string, unknown>)[key]
    const message = validator(typeof raw === 'string' ? raw : raw == null ? '' : String(raw))
    if (message) errors[key] = message
  }
  return errors
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0
}
