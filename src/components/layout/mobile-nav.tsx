import { Link, useLocation } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, UserRound } from 'lucide-react'
import { useCart } from '@/queries/cart'
import { cn } from '@/lib/utils'

/** Navegação inferior do mobile (frame "Início" mobile do layout). */
export function MobileNav() {
  const { pathname } = useLocation()
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  const item = (active: boolean) =>
    cn('flex size-12 flex-col items-center justify-center rounded-full text-sand transition-colors', active && 'text-orange')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-16 max-w-md items-center justify-between rounded-t-3xl bg-surface px-6 shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        <Link to="/" className={item(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>
          <House className="size-6" aria-hidden="true" />
          <span className="sr-only">Início</span>
        </Link>
        <Link to="/conta/favoritos" className={item(pathname === '/conta/favoritos')}>
          <Heart className="size-6" aria-hidden="true" />
          <span className="sr-only">Lista de interesse</span>
        </Link>
        <Link
          to="/mercado"
          className="-mt-10 flex size-16 items-center justify-center rounded-full border-4 border-background bg-brand text-kurio-bg shadow-lg"
          aria-current={pathname === '/mercado' ? 'page' : undefined}
        >
          <ScanLine className="size-7" aria-hidden="true" />
          <span className="sr-only">Mercado</span>
        </Link>
        <Link to="/carrinho" className={cn(item(pathname === '/carrinho'), 'relative')}>
          <ShoppingCart className="size-6" aria-hidden="true" />
          {count > 0 && (
            <span aria-hidden="true" className="absolute top-1.5 right-1 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 font-bold text-kurio-bg">
              {count}
            </span>
          )}
          <span className="sr-only">{count ? `Carrinho, ${count} itens` : 'Carrinho'}</span>
        </Link>
        <Link to="/conta/perfil" className={item(pathname.startsWith('/conta/perfil'))}>
          <UserRound className="size-6" aria-hidden="true" />
          <span className="sr-only">Minha conta</span>
        </Link>
      </div>
    </nav>
  )
}
