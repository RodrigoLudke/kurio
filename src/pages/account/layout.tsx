import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Download, HandCoins, Heart, LogOut, MapPin, ShoppingCart, TriangleAlert, UserRound } from 'lucide-react'
import { announce } from '@/lib/announce'
import { cn } from '@/lib/utils'
import { useLogout } from '@/queries/session'

const ITEMS = [
  { to: '/conta/perfil', label: 'Dados do perfil', Icon: UserRound },
  { to: '/conta/carteiras', label: 'Carteiras', Icon: MapPin },
  { to: '/conta/atividade', label: 'Atividade', Icon: ShoppingCart },
  { to: '/conta/favoritos', label: 'Lista de interesse', Icon: Heart },
] as const

const SOON = [
  { label: 'Ofertas', Icon: HandCoins },
  { label: 'Arquivos baixados', Icon: Download },
  { label: 'Suporte', Icon: TriangleAlert },
]

export function AccountLayout() {
  const { pathname } = useLocation()
  const logout = useLogout()
  const navigate = useNavigate()
  const onLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        announce('Você saiu da sua conta.', { tone: 'info', toast: true })
        void navigate({ to: '/' })
      },
    })

  return (
    <div className="container-kurio pt-4 md:pt-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr] lg:grid-cols-[310px_1fr] lg:gap-7">
        <aside className="min-w-0 self-start bg-surface py-4 max-md:-mx-4 max-md:bg-transparent max-md:py-0">
          <h2 className="mb-2 px-2.5 text-lg font-bold max-md:sr-only">Meu perfil</h2>
          <nav aria-label="Minha conta">
            <ul className="flex flex-col max-md:flex-row max-md:gap-2 max-md:overflow-x-auto max-md:px-4 max-md:pb-2">
              {ITEMS.map(({ to, label, Icon }) => {
                const active = pathname.startsWith(to)
                return (
                  <li key={to} className="shrink-0">
                    <Link
                      to={to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 border-l-[6px] px-3.5 py-3 text-[15px] transition-colors hover:text-orange focus-visible:ring-2 focus-visible:ring-ring',
                        'max-md:rounded-full max-md:border max-md:border-line max-md:px-4 max-md:py-2 max-md:text-sm',
                        active ? 'border-brand text-orange max-md:border-brand max-md:bg-band' : 'border-transparent text-[#d9955a]',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                )
              })}
              {SOON.map(({ label, Icon }) => (
                <li key={label} className="max-md:hidden">
                  <span aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 border-l-[6px] border-transparent px-3.5 py-3 text-[15px] text-[#d9955a]/70">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {label}
                    <span className="ml-auto rounded-sm bg-surface-2 px-1.5 text-[10px] text-sand">em breve</span>
                  </span>
                </li>
              ))}
              <li className="mt-1 border-t border-line max-md:mt-0 max-md:shrink-0 max-md:border-0">
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={logout.isPending}
                  className="flex w-full items-center gap-3 border-l-[6px] border-transparent px-3.5 py-3 text-[15px] font-bold text-orange hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:rounded-full max-md:border max-md:border-line max-md:px-4 max-md:py-2 max-md:text-sm"
                  data-testid="account-logout"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sair
                </button>
              </li>
            </ul>
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
