import { useEffect, useState, useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { realtime } from '@/realtime/client'

/**
 * Aviso de conexão em tempo real perdida (só aparece após 2 s para não
 * piscar em reconexões rápidas). Enquanto isso, a interface continua usando
 * REST; ao reconectar os dados são reconciliados.
 */
export function RealtimeStatus() {
  const status = useSyncExternalStore(realtime.subscribeStatus, realtime.getStatus, realtime.getStatus)
  const [visible, setVisible] = useState(false)
  const degraded = status === 'reconnecting' || status === 'offline'
  useEffect(() => {
    if (!degraded) {
      setVisible(false)
      return
    }
    const t = window.setTimeout(() => setVisible(true), 2000)
    return () => window.clearTimeout(t)
  }, [degraded])
  return (
    <div aria-live="polite" data-testid="realtime-status" data-status={status}>
      {visible && (
        <div className="container-kurio">
          <p className="mt-3 flex items-center gap-2 rounded-md border border-orange/50 bg-band/70 px-3 py-2 text-sm">
            <WifiOff className="size-4 text-orange" aria-hidden="true" />
            Conexão em tempo real interrompida. Tentando reconectar… Preços e pedidos serão atualizados ao reconectar.
          </p>
        </div>
      )}
    </div>
  )
}
