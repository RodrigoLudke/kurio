import { Link, useLocation } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/use-page-title'

const TITLES: Record<string, string> = {
  '/criadores': 'Criadores',
  '/aprenda': 'Aprenda',
  '/ajuda': 'Central de ajuda',
}

/** Seções editoriais/suporte fora do escopo: comportamento coerente, sem simular sucesso. */
export function UnavailablePage() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Seção'
  usePageTitle(title)
  return (
    <div className="container-kurio flex min-h-[55vh] flex-col items-center justify-center gap-5 py-16 text-center">
      <Construction className="size-12 text-orange" aria-hidden="true" />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-lg text-sand">
        Esta seção ainda não está disponível nesta versão da Kurio. Enquanto isso, você pode explorar o mercado e montar sua coleção.
      </p>
      <Button asChild>
        <Link to="/mercado">Explorar o mercado</Link>
      </Button>
    </div>
  )
}
