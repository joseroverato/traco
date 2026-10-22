import { layerKey, renderSheet } from './pdf'
import { useStore } from './store'
import type { Sheet } from './types'

const cache = new Map<string, Promise<string>>()
const ready = new Map<string, string>()
const keyOf = (s: Sheet, width: number) => `${s.src}:${s.srcIndex}:${s.rot}:${width}:${layerKey(s.src)}`

/** Miniatura que já foi renderizada, se houver (para aparecer no primeiro quadro, sem piscar). */
export const peekThumb = (s: Sheet, width = 240): string | null => ready.get(keyOf(s, width)) ?? null
let queue: Promise<unknown> = Promise.resolve()

/** Miniatura (dataURL) em cache por página+rotação; renderiza em fila para não travar. */
export function thumbOf(s: Sheet, width = 240): Promise<string> {
  const key = keyOf(s, width)
  let p = cache.get(key)
  if (!p) {
    p = new Promise<string>((resolve, reject) => {
      queue = queue.then(async () => {
        try {
          const src = useStore.getState().sources[s.src]
          if (!src) throw new Error('fonte ausente')
          const c = await renderSheet(src, s, (width * (window.devicePixelRatio || 1)) / s.width)
          const url = c.toDataURL('image/jpeg', 0.82)
          ready.set(key, url)
          resolve(url)
        } catch (e) {
          cache.delete(key)
          reject(e)
        }
      })
    })
    cache.set(key, p)
  }
  return p
}
