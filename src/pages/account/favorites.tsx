import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { errorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/features/nft/nft-card'
import { usePageTitle } from '@/lib/use-page-title'
import { useFavorites } from '@/queries/favorites'

export function FavoritesPage() {
  usePageTitle('Lista de interesse')
  const favorites = useFavorites()
  return (
    <section aria-labelledby="fav-title" className="flex flex-col gap-6">
      <h1 id="fav-title" className="text-lg font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : favorites.isError ? (
        <Alert tone="error" className="flex-col items-start">
          {errorMessage(favorites.error)}
          <Button size="sm" onClick={() => void favorites.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      ) : favorites.data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center" data-testid="favorites-empty">
          <Heart className="size-10 text-orange" aria-hidden="true" />
          <p className="text-sand">Você ainda não favoritou nenhum NFT.</p>
          <Button asChild>
            <Link to="/mercado">Explorar o mercado</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3" data-testid="favorites-grid">
          {favorites.data.items.map((nft) => (
            <NftCard key={nft.id} nft={nft} />
          ))}
        </div>
      )}
    </section>
  )
}
