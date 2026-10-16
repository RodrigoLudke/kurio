import { Outlet } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Footer } from './footer'
import { Header, useRouteFlags } from './header'
import { LiveRegion } from './live-region'
import { MobileNav } from './mobile-nav'
import { RealtimeStatus } from './realtime-status'

const Toaster = lazy(() => import('@/components/ui/sonner').then((m) => ({ default: m.Toaster })))

/** Monta componentes secundários só depois que a página inicial terminou de carregar. */
function useAfterLoad() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const run = () => setReady(true)
    if (document.readyState === 'complete') {
      const id = window.setTimeout(run, 800)
      return () => window.clearTimeout(id)
    }
    window.addEventListener('load', run, { once: true })
    return () => window.removeEventListener('load', run)
  }, [])
  return ready
}

const MockPanel = import.meta.env.VITE_ENABLE_MOCKS === 'true' && import.meta.env.VITE_MOCK_PANEL === 'true' ? lazy(() => import('@/features/mock-panel/mock-panel')) : null

export function RootLayout() {
  const flags = useRouteFlags()
  const afterLoad = useAfterLoad()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only-focusable fixed top-2 left-2 z-[100] rounded-md bg-brand px-4 py-2 font-bold text-kurio-bg"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <RealtimeStatus />
      <main id="conteudo" tabIndex={-1} className={cn('min-h-dvh flex-1 outline-none', !flags.hideMobileNav && 'max-md:pb-20')}>
        <Outlet />
      </main>
      <Footer className={cn(flags.hideMobileFooter && 'max-md:hidden', !flags.hideMobileNav && 'max-md:mb-16')} />
      {!flags.hideMobileNav && <MobileNav />}
      <LiveRegion />
      {/* o Toaster é montado já no início: toasts disparados cedo não se perdem */}
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
      {MockPanel && afterLoad && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </div>
  )
}
