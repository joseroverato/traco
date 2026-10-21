import { useSyncExternalStore } from 'react'
import { IS_DESKTOP } from './platform'

/** Celular: tela estreita, ou celular deitado (pouca altura com toque). O app de PC nunca usa o layout de celular. */
const QUERY = '(max-width: 820px), (max-height: 500px) and (pointer: coarse)'
const mq = typeof window !== 'undefined' && !IS_DESKTOP && window.matchMedia ? window.matchMedia(QUERY) : null

export const isMobileNow = () => !!mq?.matches

export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb)
      return () => mq?.removeEventListener('change', cb)
    },
    isMobileNow,
    () => false,
  )
}
