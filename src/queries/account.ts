import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ChangePasswordRequest,
  ConnectWalletRequest,
  CreateOrderRequest,
  CreateWalletRequest,
  Order,
  Profile,
  UpdateProfileRequest,
  WalletInput,
} from '@/api/contracts'
import { toAppError } from '@/api/errors'
import { ordersApi, profileApi, walletsApi } from '@/api/endpoints'
import { keys } from './keys'
import { useCurrentUser } from './session'

function useUserKey() {
  const { userId } = useCurrentUser()
  return userId ?? 'anonymous'
}

/* ------------------------------ Perfil ------------------------------ */

export function useProfile() {
  const userId = useUserKey()
  return useQuery({
    queryKey: keys.profile(userId),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: userId !== 'anonymous',
  })
}

function useProfileMutation<TVars>(fn: (vars: TVars) => Promise<Profile>) {
  const queryClient = useQueryClient()
  const userId = useUserKey()
  return useMutation({
    mutationFn: fn,
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.profile(userId), profile)
      // o cabeçalho mostra nome/avatar a partir da sessão
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })
}

export function useUpdateProfile() {
  return useProfileMutation((body: UpdateProfileRequest) => profileApi.update(body))
}

export function useUploadAvatar() {
  return useProfileMutation((file: File) => profileApi.uploadAvatar(file))
}

export function useRemoveAvatar() {
  return useProfileMutation(() => profileApi.removeAvatar())
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: ChangePasswordRequest) => profileApi.changePassword(body) })
}

/* ----------------------------- Carteiras ---------------------------- */

export function useWallets() {
  const userId = useUserKey()
  return useQuery({
    queryKey: keys.wallets(userId),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
    enabled: userId !== 'anonymous',
    select: (data) => data.items,
  })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const userId = useUserKey()
  return useMutation({
    mutationFn: (vars: { id: string | null; body: CreateWalletRequest | WalletInput }) =>
      vars.id ? walletsApi.update(vars.id, vars.body) : walletsApi.create(vars.body as CreateWalletRequest),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.wallets(userId) })
    },
  })
}

export function useWalletConnection(walletId: string | null) {
  const userId = useUserKey()
  return useQuery({
    queryKey: keys.walletConnection(userId, walletId ?? 'none'),
    queryFn: ({ signal }) => walletsApi.connection(walletId!, { signal }),
    enabled: userId !== 'anonymous' && !!walletId,
    select: (data) => data.connection,
    staleTime: 10_000,
  })
}

export function useConnectWallet() {
  const queryClient = useQueryClient()
  const userId = useUserKey()
  return useMutation({
    mutationFn: ({ walletId, body }: { walletId: string; body: ConnectWalletRequest }) => walletsApi.connect(walletId, body),
    onSuccess: (data, { walletId }) => {
      queryClient.setQueryData(keys.walletConnection(userId, walletId), data)
    },
  })
}

export function useDisconnectWallet() {
  const queryClient = useQueryClient()
  const userId = useUserKey()
  return useMutation({
    mutationFn: (walletId: string) => walletsApi.disconnect(walletId),
    onSuccess: (data, walletId) => {
      queryClient.setQueryData(keys.walletConnection(userId, walletId), data)
    },
  })
}

/* ------------------------------ Pedidos ----------------------------- */

export function useOrders() {
  const userId = useUserKey()
  return useQuery({
    queryKey: keys.orders(userId),
    queryFn: ({ signal }) => ordersApi.list({ signal }),
    enabled: userId !== 'anonymous',
    select: (data) => data.items,
  })
}

/**
 * Pedido por id. Enquanto pendente, além do `order.updated` via Socket.IO,
 * faz polling leve como rede de segurança (ex.: socket desconectado).
 */
export function useOrder(orderId: string, options: { pollMs?: number } = {}) {
  const userId = useUserKey()
  return useQuery({
    queryKey: keys.order(userId, orderId),
    queryFn: ({ signal }) => ordersApi.get(orderId, { signal }),
    enabled: userId !== 'anonymous',
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? (options.pollMs ?? 8000) : false),
  })
}

export interface CreateOrderVars {
  body: CreateOrderRequest
  idempotencyKey: string
}

/**
 * Criação idempotente: em timeout/falha de rede o mesmo payload é reenviado
 * com a MESMA chave — o servidor devolve o pedido já criado em vez de criar
 * outro. Erros 4xx não são repetidos.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  const userId = useUserKey()
  return useMutation({
    mutationKey: ['create-order', userId],
    mutationFn: ({ body, idempotencyKey }: CreateOrderVars) => ordersApi.create(body, idempotencyKey),
    retry: (failureCount, error) => {
      const e = toAppError(error)
      return (e.kind === 'timeout' || e.kind === 'network' || (e.status ?? 0) >= 500) && failureCount < 3
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    onSuccess: (order: Order) => {
      queryClient.setQueryData(keys.order(userId, order.id), order)
      void queryClient.invalidateQueries({ queryKey: keys.orders(userId) })
    },
  })
}
