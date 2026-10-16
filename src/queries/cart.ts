import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest, Cart, NetworkId } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { keys } from './keys'
import { useCartOwner } from './session'

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: keys.cart(owner),
    queryFn: ({ signal }) => cartApi.get({ signal }),
    staleTime: 15_000,
  })
}

/** Carrinho com o resumo calculado para a rede escolhida no pagamento. */
export function useCartForNetwork(network: NetworkId) {
  const owner = useCartOwner()
  return useQuery({
    queryKey: [...keys.cart(owner), 'network', network],
    queryFn: ({ signal }) => cartApi.get({ signal, network }),
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  })
}

/** Toda mutation do carrinho retorna o carrinho recalculado pelo servidor. */
function useCartMutation<TVars>(fn: (vars: TVars) => Promise<Cart>) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationKey: ['cart-mutation', owner],
    mutationFn: fn,
    onSuccess: (cart) => {
      queryClient.setQueryData(keys.cart(owner), cart)
      void queryClient.invalidateQueries({ queryKey: [...keys.cart(owner), 'network'] })
    },
    onError: () => {
      // conflito de disponibilidade etc.: ressincroniza com o servidor
      void queryClient.invalidateQueries({ queryKey: keys.cart(owner) })
    },
  })
}

export function useAddToCart() {
  return useCartMutation((body: AddCartItemRequest) => cartApi.addItem(body))
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.updateItem(itemId, { quantity }))
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => cartApi.removeItem(itemId))
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => cartApi.applyCoupon({ code }))
}

export function useRemoveCoupon() {
  return useCartMutation(() => cartApi.removeCoupon())
}

export function useAcknowledgeCart() {
  return useCartMutation(() => cartApi.acknowledge())
}
