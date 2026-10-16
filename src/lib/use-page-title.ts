import { useEffect } from 'react'

const BASE = 'Kurio — Marketplace de NFTs'

/** Define o título do documento (anunciado por leitores de tela na troca de rota). */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} | Kurio` : BASE
  }, [title])
}
