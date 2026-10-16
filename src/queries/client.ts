import { QueryClient } from '@tanstack/react-query'
import { AppError, toAppError } from '@/api/errors'

/**
 * Política de cache e retries (documentada no ARCHITECTURE.md):
 * - consultas públicas (catálogo/detalhe) ficam "frescas" por 30 s e são
 *   atualizadas em segundo plano; eventos `nft.updated` corrigem o cache
 *   entre um refetch e outro;
 * - erros transitórios (rede, timeout, 5xx/503 marcados como retryable) têm
 *   até 2 novas tentativas com backoff exponencial; 4xx nunca é repetido;
 * - mutations não repetem automaticamente, exceto a criação de pedido, que
 *   reenvia a MESMA chave de idempotência (ver useCreateOrder).
 */
export function shouldRetry(failureCount: number, error: unknown) {
  const appError = toAppError(error)
  if (appError.kind === 'cancelled') return false
  if (appError.status !== null && appError.status < 500) return false
  return appError.retryable && failureCount < 2
}

export const retryDelay = (attempt: number) => Math.min(800 * 2 ** attempt, 4000)

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const queryClient = createQueryClient()

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
