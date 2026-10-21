import { useSyncExternalStore } from 'react'
import type { Tool } from './types'

/** Letras de fábrica de cada ferramenta (as mesmas de sempre). A pessoa pode trocar cada uma nas Configurações. */
export const DEFAULT_KEYS: Record<string, string> = {
  select: 'V', pan: 'H', cloud: 'C', rect: 'R', ellipse: 'E', arrow: 'A', line: 'I', text: 'T', stamp: 'B', image: 'P', redact: 'D',
  calibrate: 'S', length: 'L', area: 'K', fill: 'G', hole: 'O', count: 'N', symbol: 'Q', space: 'M', solid: 'U', viewport: 'X',
}

/** Letras que o app já usa em outro lugar (W = ajustar à largura) e não podem ser de ferramenta. */
export const RESERVED_KEYS = ['W']

const STORE = 'traco.keys'
let custom: Record<string, string> = load()
const listeners = new Set<() => void>()
let version = 0

function load(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}')
    const out: Record<string, string> = {}
    for (const [id, k] of Object.entries(raw)) if (id in DEFAULT_KEYS && typeof k === 'string' && validKey(k)) out[id] = k.toUpperCase()
    return unique(out)
  } catch {
    return {}
  }
}

export const validKey = (k: string) => /^[a-zA-Z]$/.test(k) && !RESERVED_KEYS.includes(k.toUpperCase())

/** Descarta personalizações que ficariam repetidas (dado salvo à mão ou de versão antiga). */
function unique(c: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  const taken = new Set<string>()
  for (const id of Object.keys(DEFAULT_KEYS)) {
    const k = c[id] ?? DEFAULT_KEYS[id]
    if (taken.has(k)) continue
    taken.add(k)
    if (c[id]) out[id] = c[id]
  }
  return out
}

export const keyOf = (tool: Tool | string): string => custom[tool] ?? DEFAULT_KEYS[tool] ?? ''

/** Qual ferramenta usa essa letra hoje (ou undefined). */
export function toolForKey(k: string): string | undefined {
  const up = k.toUpperCase()
  return Object.keys(DEFAULT_KEYS).find((id) => keyOf(id) === up)
}

function commit() {
  version++
  try {
    if (Object.keys(custom).length) localStorage.setItem(STORE, JSON.stringify(custom))
    else localStorage.removeItem(STORE)
  } catch { /* sem armazenamento: vale só nesta sessão */ }
  listeners.forEach((l) => l())
}

/** Troca a letra de uma ferramenta. Devolve a ferramenta que já usa a letra (e então não troca), ou null se deu certo. */
export function setKey(tool: string, k: string): string | null {
  if (!validKey(k) || !(tool in DEFAULT_KEYS)) return null
  const up = k.toUpperCase()
  const owner = toolForKey(up)
  if (owner && owner !== tool) return owner
  if (DEFAULT_KEYS[tool] === up) delete custom[tool]
  else custom[tool] = up
  commit()
  return null
}

export function resetKeys() {
  custom = {}
  commit()
}

export const hasCustomKeys = () => Object.keys(custom).length > 0

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))
/** Faz o componente redesenhar quando uma letra muda. */
export const useKeymap = () => useSyncExternalStore(subscribe, () => version)
