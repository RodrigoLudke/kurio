import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { markTransportReady } from '@/api/client'
import { captureMockBootParams } from '@/mocks/boot'
import { startMockServer } from 'virtual:kurio-mocks'
import { queryClient } from '@/queries/client'
import { installSessionLifecycle } from '@/app/session-lifecycle'
import { installRealtimeSync } from '@/realtime/sync'
import { router } from '@/router'

if (startMockServer) {
  captureMockBootParams()
  // o servidor simulado sobe em paralelo à renderização; as requisições
  // aguardam o portão de transporte (ver api/client.ts)
  startMockServer()
    .then(markTransportReady)
    .catch((error: unknown) => {
      console.error('Falha ao iniciar o servidor simulado (MSW).', error)
      markTransportReady()
    })
} else {
  markTransportReady()
}

installSessionLifecycle(queryClient, router)
installRealtimeSync(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
