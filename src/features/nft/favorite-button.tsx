import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { toAppError } from '@/api/errors'
import { announce } from '@/lib/announce'
import { cn } from '@/lib/utils'
import { useIsFavorite, useToggleFavorite } from '@/queries/favorites'
import { useCurrentUser } from '@/queries/session'

/** Liga/desliga favorito com atualização otimista e rollback em falha. */
export function useFavoriteToggle(nftId: string, nftName: string) {
  const { isAuthenticated } = useCurrentUser()
  const isFavorite = useIsFavorite(nftId)
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const location = useLocation()

  const onToggle = () => {
    if (!isAuthenticated) {
      announce('Entre na sua conta para salvar favoritos.', { tone: 'info', toast: true })
      void navigate({ to: '/entrar', search: { redirect: location.href } })
      return
    }
    const favorite = !isFavorite
    toggle.mutate(
      { nftId, favorite },
      {
        onSuccess: () => announce(favorite ? `${nftName} adicionado à lista de interesse.` : `${nftName} removido da lista de interesse.`),
        onError: (error) =>
          announce(`${toAppError(error).message} O favorito de ${nftName} foi restaurado.`, { tone: 'error', toast: true }),
      },
    )
  }
  return { isFavorite, onToggle, isPending: toggle.isPending }
}

export function FavoriteIconButton({ nftId, nftName, className }: { nftId: string; nftName: string; className?: string }) {
  const { isFavorite, onToggle } = useFavoriteToggle(nftId, nftName)
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${nftName} da lista de interesse` : `Adicionar ${nftName} à lista de interesse`}
      className={cn(
        'flex size-9 items-center justify-center rounded-full bg-kurio-bg/80 text-orange backdrop-blur transition-colors hover:bg-kurio-bg focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      data-testid={`favorite-${nftId}`}
    >
      <Heart className={cn('size-5', isFavorite && 'fill-current')} aria-hidden="true" />
    </button>
  )
}
