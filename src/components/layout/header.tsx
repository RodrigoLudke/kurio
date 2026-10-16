import { Link, useLocation, useMatches, useNavigate } from '@tanstack/react-router'
import { LogIn, LogOut, Search, ShoppingCart, UserRound, Wallet, Heart, Activity } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useCart } from '@/queries/cart'
import { useCurrentUser, useLogout } from '@/queries/session'
import { announce } from '@/lib/announce'
import { cn } from '@/lib/utils'
import { Avatar } from './avatar'
import { Logo } from './logo'

const NAV = [
  { to: '/', label: 'Início', section: 'inicio' },
  { to: '/mercado', label: 'Mercado', section: 'mercado' },
  { to: '/criadores', label: 'Criadores', section: 'criadores' },
  { to: '/aprenda', label: 'Aprenda', section: 'aprenda' },
] as const

export function useRouteFlags() {
  const matches = useMatches()
  const flags = matches.reduce<Record<string, unknown>>((acc, m) => ({ ...acc, ...(m.staticData ?? {}) }), {})
  return flags as {
    section?: string
    ownMobileHeader?: boolean
    hideMobileNav?: boolean
    hideMobileFooter?: boolean
    private?: boolean
  }
}

export function CartLink({ className }: { className?: string }) {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Link
      to="/carrinho"
      className={cn('relative inline-flex size-10 items-center justify-center rounded-md text-foreground hover:text-orange', className)}
      aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
      data-testid="header-cart"
    >
      <ShoppingCart className="size-6" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 right-0 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4 font-bold text-kurio-bg"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export function SearchDialog({ open, onOpenChange, trigger }: { open: boolean; onOpenChange: (open: boolean) => void; trigger?: ReactNode }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onOpenChange(false)
    void navigate({ to: '/mercado', search: value.trim() ? { q: value.trim() } : {} })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="top-24 translate-y-0 border-b-4 sm:max-w-xl">
        <DialogTitle>Buscar no mercado</DialogTitle>
        <DialogDescription>Procure por nome do NFT, coleção, criador ou ID do token.</DialogDescription>
        <form role="search" onSubmit={submit} className="flex gap-2">
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input
            id="global-search"
            type="search"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex.: Emerald Ape"
            autoComplete="off"
          />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UserMenu() {
  const { user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        announce('Você saiu da sua conta.', { tone: 'info', toast: true })
        void navigate({ to: '/' })
      },
    })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-sm hover:border-orange focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="user-menu"
        >
          <Avatar url={user?.avatarUrl ?? null} name={user?.displayName ?? ''} size={28} />
          <span className="hidden max-w-[10rem] truncate lg:inline">{user?.displayName ?? 'Minha conta'}</span>
          <span className="sr-only lg:hidden">Menu da conta</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/conta/perfil">
            <UserRound aria-hidden="true" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/conta/carteiras">
            <Wallet aria-hidden="true" /> Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/conta/favoritos">
            <Heart aria-hidden="true" /> Lista de interesse
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/conta/atividade">
            <Activity aria-hidden="true" /> Meus pedidos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} data-testid="logout">
          <LogOut aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header() {
  const flags = useRouteFlags()
  const location = useLocation()
  const { isAuthenticated } = useCurrentUser()
  const [searchOpen, setSearchOpen] = useState(false)
  const redirect = location.pathname === '/entrar' || location.pathname === '/cadastro' ? undefined : location.href

  return (
    <header className={cn('relative z-30 bg-background', flags.ownMobileHeader && 'max-md:hidden')}>
      <div className="container-kurio flex h-[74px] items-center justify-between gap-4 border-b border-line">
        <Logo />
        <nav aria-label="Principal" className="hidden h-full md:block">
          <ul className="flex h-full items-stretch gap-6 lg:gap-10">
            {NAV.map((item) => {
              const active = flags.section === item.section
              return (
                <li key={item.to} className="flex">
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center pb-1 text-[15px] tracking-wide transition-colors hover:text-orange',
                      active ? 'font-bold text-orange after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-2 md:gap-3">
          <SearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            trigger={
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-md hover:text-orange focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Buscar NFTs"
              >
                <Search className="size-6" aria-hidden="true" />
              </button>
            }
          />
          <CartLink />
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Button asChild size="sm" className="h-9 gap-1.5 px-3 text-[15px] font-medium">
              <Link to="/entrar" search={redirect ? { redirect } : {}} data-testid="header-login">
                <LogIn className="size-5" aria-hidden="true" />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
