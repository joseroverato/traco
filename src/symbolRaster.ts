/** Contagem automática por imagem — para pranchas escaneadas (sem linhas vetoriais). */
import { useStore } from './store'
import { renderSheet } from './pdf'
import { findSymbolsRaster } from './geoWorker'
import type { Pt, Sheet } from './types'

export async function findSymbolsRasterOn(sheet: Sheet, rect: { x: number; y: number; w: number; h: number }): Promise<Pt[]> {
  const src = useStore.getState().sources[sheet.src]
  const k = Math.min(2, 2600 / Math.max(sheet.width, sheet.height)) // px por pt
  const c = await renderSheet(src, sheet, k)
  const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  const gray = new Uint8Array(c.width * c.height)
  for (let i = 0; i < gray.length; i++) gray[i] = (img[i * 4] * 0.299 + img[i * 4 + 1] * 0.587 + img[i * 4 + 2] * 0.114) | 0
  const r = await findSymbolsRaster(gray, c.width, c.height, k, rect)
  return r.centers.map(([x, y]) => ({ x, y }))
}
