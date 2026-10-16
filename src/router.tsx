import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  type ParsedLocation,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { sessionStore } from '@/api/session-store'
import { queryClient } from '@/queries/client'
import { RootLayout } from '@/components/layout/root-layout'
import { NotFoundPage } from '@/pages/not-found'
import { RouteError } from '@/components/layout/route-error'
import { PageLoader } from '@/components/layout/page-loader'
import { HomePage } from '@/pages/home'
import { parseSearch, stringifySearch, validateCatalogSearch } from '@/features/catalog/search'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** exige sessão autenticada */
    private?: boolean
    /** item ativo na navegação principal */
    section?: 'inicio' | 'mercado' | 'criadores' | 'aprenda'
    /** a página tem barra superior própria no mobile */
    ownMobileHeader?: boolean
    /** esconde a navegação inferior no mobile (página tem CTA fixo) */
    hideMobileNav?: boolean
    /** esconde o rodapé no mobile */
    hideMobileFooter?: boolean
  }
  interface Register {
    router: typeof router
  }
}

export interface RouterContext {
  queryClient: QueryClient
}

/** Protege rotas privadas preservando o destino para retomada após o login. */
function requireAuth({ location }: { location: ParsedLocation }) {
  if (!sessionStore.getState().session) {
    throw redirect({ to: '/entrar', search: { redirect: location.href } })
  }
}

const authSearch = (raw: Record<string, unknown>): { redirect?: string; motivo?: 'expirada' } => {
  const out: { redirect?: string; motivo?: 'expirada' } = {}
  // apenas caminhos internos (evita open redirect)
  if (typeof raw.redirect === 'string' && raw.redirect.startsWith('/') && !raw.redirect.startsWith('//')) out.redirect = raw.redirect
  if (raw.motivo === 'expirada') out.motivo = 'expirada'
  return out
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteError,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  staticData: { section: 'inicio', ownMobileHeader: true },
  component: HomePage,
})

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mercado',
  validateSearch: validateCatalogSearch,
  staticData: { section: 'mercado' },
  component: lazyRouteComponent(() => import('@/pages/market'), 'MarketPage'),
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  staticData: { section: 'mercado', ownMobileHeader: true, hideMobileNav: true, hideMobileFooter: true },
  component: lazyRouteComponent(() => import('@/pages/nft-detail'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  staticData: { section: 'mercado', ownMobileHeader: true, hideMobileNav: true, hideMobileFooter: true },
  component: lazyRouteComponent(() => import('@/pages/cart'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagamento',
  beforeLoad: requireAuth,
  staticData: { private: true, section: 'mercado', ownMobileHeader: true, hideMobileNav: true, hideMobileFooter: true },
  component: lazyRouteComponent(() => import('@/pages/checkout'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedidos/$orderId',
  beforeLoad: requireAuth,
  staticData: { private: true, section: 'mercado', hideMobileFooter: true },
  component: lazyRouteComponent(() => import('@/pages/order'), 'OrderPage'),
})

const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explorador/$hash',
  beforeLoad: requireAuth,
  validateSearch: (raw: Record<string, unknown>) => ({ pedido: typeof raw.pedido === 'string' ? raw.pedido : undefined }),
  staticData: { private: true },
  component: lazyRouteComponent(() => import('@/pages/explorer'), 'ExplorerPage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: authSearch,
  staticData: { section: 'inicio', ownMobileHeader: true, hideMobileNav: true, hideMobileFooter: true },
  component: lazyRouteComponent(() => import('@/pages/auth'), 'LoginPage'),
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: authSearch,
  staticData: { section: 'inicio', ownMobileHeader: true, hideMobileNav: true, hideMobileFooter: true },
  component: lazyRouteComponent(() => import('@/pages/auth'), 'SignupPage'),
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conta',
  beforeLoad: requireAuth,
  staticData: { private: true },
  component: lazyRouteComponent(() => import('@/pages/account/layout'), 'AccountLayout'),
})

const accountIndexRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/conta/perfil' })
  },
})

const profileRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/perfil',
  staticData: { private: true },
  component: lazyRouteComponent(() => import('@/pages/account/profile'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/carteiras',
  staticData: { private: true },
  validateSearch: (raw: Record<string, unknown>) => authSearch(raw),
  component: lazyRouteComponent(() => import('@/pages/account/wallets'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/favoritos',
  staticData: { private: true },
  component: lazyRouteComponent(() => import('@/pages/account/favorites'), 'FavoritesPage'),
})

const ordersRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/atividade',
  staticData: { private: true },
  component: lazyRouteComponent(() => import('@/pages/account/orders'), 'OrdersPage'),
})

const unavailableComponent = lazyRouteComponent(() => import('@/pages/unavailable'), 'UnavailablePage')
const creatorsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/criadores', staticData: { section: 'criadores' }, component: unavailableComponent })
const learnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/aprenda', staticData: { section: 'aprenda' }, component: unavailableComponent })
const helpRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ajuda', component: unavailableComponent })

const routeTree = rootRoute.addChildren([
  homeRoute,
  marketRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  explorerRoute,
  loginRoute,
  signupRoute,
  accountRoute.addChildren([accountIndexRoute, profileRoute, walletsRoute, favoritesRoute, ordersRoute]),
  creatorsRoute,
  learnRoute,
  helpRoute,
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  parseSearch,
  stringifySearch,
  scrollRestoration: true,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: PageLoader,
  defaultPendingMs: 150,
  defaultNotFoundComponent: NotFoundPage,
})
