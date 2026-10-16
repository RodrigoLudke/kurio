import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/use-page-title'

export function NotFoundPage() {
  usePageTitle('Página não encontrada')
  return (
    <div className="container-kurio flex min-h-[55vh] flex-col items-center justify-center gap-5 py-16 text-center">
      <p className="text-6xl font-bold text-orange">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-sand">O endereço acessado não existe ou foi movido. Que tal voltar ao mercado?</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link to="/">Ir para o início</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/mercado">Explorar o mercado</Link>
        </Button>
      </div>
    </div>
  )
}
