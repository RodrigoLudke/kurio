import axios, { type AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'

export type AppErrorKind = 'http' | 'network' | 'timeout' | 'cancelled' | 'unknown'

/**
 * Erro normalizado consumido pela interface. Todo erro do Axios passa por
 * `toAppError` no interceptor de resposta, então hooks e componentes nunca
 * lidam com AxiosError diretamente.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly status: number | null
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELLED' | 'UNKNOWN'
  readonly fieldErrors: Record<string, string>
  readonly retryable: boolean
  readonly details: unknown

  constructor(init: {
    kind: AppErrorKind
    message: string
    status?: number | null
    code: AppError['code']
    fieldErrors?: Record<string, string>
    retryable?: boolean
    details?: unknown
  }) {
    super(init.message)
    this.name = 'AppError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
    this.retryable = init.retryable ?? false
    this.details = init.details
  }

  is(code: AppError['code']): boolean {
    return this.code === code
  }
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ApiErrorBody).error?.code === 'string'
  )
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (axios.isCancel(error)) {
    return new AppError({ kind: 'cancelled', code: 'CANCELLED', message: 'Requisição cancelada.' })
  }
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new AppError({
        kind: 'timeout',
        code: 'TIMEOUT',
        message: 'O servidor demorou para responder. Verifique sua conexão e tente novamente.',
        retryable: true,
      })
    }
    const response = axiosError.response
    if (!response) {
      return new AppError({
        kind: 'network',
        code: 'NETWORK_ERROR',
        message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
        retryable: true,
      })
    }
    if (isApiErrorBody(response.data)) {
      const body = response.data.error
      return new AppError({
        kind: 'http',
        status: response.status,
        code: body.code,
        message: body.message,
        fieldErrors: body.fieldErrors,
        retryable: body.retryable ?? response.status >= 500,
        details: body.details,
      })
    }
    return new AppError({
      kind: 'http',
      status: response.status,
      code: response.status >= 500 ? 'INTERNAL' : 'UNKNOWN',
      message:
        response.status >= 500
          ? 'O servidor encontrou um erro. Tente novamente em instantes.'
          : 'Não foi possível concluir a solicitação.',
      retryable: response.status >= 500,
    })
  }
  return new AppError({
    kind: 'unknown',
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'Erro inesperado.',
  })
}

/** Mensagem amigável para qualquer erro. */
export function errorMessage(error: unknown): string {
  return toAppError(error).message
}
