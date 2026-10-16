import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/api/errors'

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()
  useEffect(() => reset(), [reset])
  return (
    <div className="container-kurio flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="max-w-md text-sand">{errorMessage(error)}</p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  )
}
