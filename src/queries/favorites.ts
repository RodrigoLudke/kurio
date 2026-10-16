import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FavoritesResponse } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { keys } from './keys'
import { useCurrentUser } from './session'

export function useFavorites() {
  const { userId } = useCurrentUser()
  return useQuery({
    queryKey: keys.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: !!userId,
  })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

/**
 * Atualização otimista: o coração muda na hora; em caso de falha, o cache é
 * restaurado para o snapshot anterior (rollback) e o erro é anunciado.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { userId } = useCurrentUser()
  const key = keys.favorites(userId ?? 'anonymous')
  return useMutation({
    mutationKey: ['favorite-toggle', userId],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const base = old ?? { nftIds: [], items: [] }
        const nftIds = favorite ? [nftId, ...base.nftIds.filter((id) => id !== nftId)] : base.nftIds.filter((id) => id !== nftId)
        return { nftIds, items: favorite ? base.items : base.items.filter((i) => i.id !== nftId) }
      })
      return { previous }
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(key, context?.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
