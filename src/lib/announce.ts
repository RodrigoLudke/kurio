/**
 * Feedback acessível: publica mensagens numa região aria-live (lida por
 * leitores de tela) e, opcionalmente, mostra um toast visual.
 */

export type AnnounceTone = 'info' | 'success' | 'warning' | 'error'

interface Message {
  id: number
  text: string
  politeness: 'polite' | 'assertive'
}

let current: Message = { id: 0, text: '', politeness: 'polite' }
const listeners = new Set<() => void>()

export const announcer = {
  get: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function announce(text: string, options: { tone?: AnnounceTone; toast?: boolean } = {}) {
  const tone = options.tone ?? 'info'
  if (options.toast) {
    // o Toaster (sonner) já é uma região aria-live: evita leitura duplicada
    // sonner é carregado sob demanda (fora do bundle inicial)
    void import('sonner').then(({ toast }) => {
      const show = tone === 'success' ? toast.success : tone === 'error' ? toast.error : tone === 'warning' ? toast.warning : toast.info
      show(text)
    })
    return
  }
  current = { id: current.id + 1, text, politeness: tone === 'error' ? 'assertive' : 'polite' }
  listeners.forEach((l) => l())
}
