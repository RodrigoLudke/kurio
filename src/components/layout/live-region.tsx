import { useSyncExternalStore } from 'react'
import { announcer } from '@/lib/announce'

/** Região aria-live global usada por `announce()` (mutations e tempo real). */
export function LiveRegion() {
  const message = useSyncExternalStore(announcer.subscribe, announcer.get, announcer.get)
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
        {message.politeness === 'polite' ? <span key={message.id}>{message.text}</span> : null}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {message.politeness === 'assertive' ? <span key={message.id}>{message.text}</span> : null}
      </div>
    </>
  )
}
