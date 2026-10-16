import { Link } from '@tanstack/react-router'
import { CatalogSection } from '@/features/catalog/catalog-section'
import { usePageTitle } from '@/lib/use-page-title'

export function MarketPage() {
  usePageTitle('Mercado')
  return (
    <div className="pt-4 md:pt-8">
      <CatalogSection
        route="/mercado"
        heading={
          <div className="mb-8 hidden md:block">
            <p className="mb-2 text-sm font-bold">
              <Link to="/" className="hover:text-orange">Início</Link> <span aria-hidden="true">/</span> Mercado
            </p>
            <h1 className="text-[28px] font-bold tracking-wide">Mercado</h1>
            <p className="mt-2 text-sm text-sand">Explore todas as coleções, combine filtros e encontre sua próxima obra.</p>
          </div>
        }
      />
    </div>
  )
}
