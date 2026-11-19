/** Camadas (OCG) do PDF da folha aberta: leitura com cache e comandos Mostrar todas / Ocultar todas / alternar. */
import { useEffect, useState } from 'react'
import { curSheet, useStore } from './store'
import { layersOf } from './pdf'
import type { LayerInfo } from './pdf'
import type { Source } from './pdf'

const cache = new Map<string, Promise<LayerInfo[]>>()
/** Lê as camadas de um PDF uma vez só (a leitura abre o documento). */
export const loadLayers = (src: Source) => {
  let p = cache.get(src.id)
  if (!p) { p = layersOf(src); cache.set(src.id, p) }
  return p
}

/** Camadas do PDF da folha atual: null enquanto lê. */
export function useLayers(): { src: Source | undefined; layers: LayerInfo[] | null } {
  const src = useStore((s) => { const sh = curSheet(s); return sh ? s.sources[sh.src] : undefined })
  const [layers, setLayers] = useState<LayerInfo[] | null>(null)
  useEffect(() => {
    let alive = true
    setLayers(null)
    if (src) void loadLayers(src).then((l) => alive && setLayers(l))
    return () => { alive = false }
  }, [src?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return { src, layers }
}

const setHidden = (srcId: string, hidden: string[]) => {
  const s = useStore.getState()
  s.set({ hiddenLayers: { ...s.hiddenLayers, [srcId]: hidden } })
}

export function toggleLayer(srcId: string, id: string) {
  const hidden = useStore.getState().hiddenLayers[srcId] ?? []
  setHidden(srcId, hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
}

/** Liga todas as camadas do PDF da folha atual. */
export function showAllLayers() {
  const s = useStore.getState()
  const sh = curSheet(s)
  if (sh) setHidden(sh.src, [])
}

/** Desliga todas as camadas do PDF da folha atual (precisa lê-las; usa o cache). */
export async function hideAllLayers() {
  const s = useStore.getState()
  const sh = curSheet(s)
  const src = sh && s.sources[sh.src]
  if (!sh || !src) return
  const layers = await loadLayers(src)
  setHidden(src.id, layers.map((l) => l.id))
}
