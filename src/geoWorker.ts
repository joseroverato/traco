/** Cliente do worker de geometria (área por clique e contagem automática). */
import GeoWorker from './geo.worker.ts?worker&inline'
import type { SnapIndex } from './snap'
import type { Pt, Sheet } from './types'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { res: (v: unknown) => void; rej: (e: unknown) => void }>()
const loaded = new Map<string, SnapIndex>()

function w() {
  if (!worker) {
    worker = new GeoWorker()
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.error) p.rej(new Error(e.data.error))
      else p.res(e.data.result)
    }
  }
  return worker
}
function call<T>(type: string, payload: unknown, transfer: Transferable[] = []): Promise<T> {
  const id = ++seq
  return new Promise<T>((res, rej) => {
    pending.set(id, { res: res as (v: unknown) => void, rej })
    w().postMessage({ id, type, payload }, transfer)
  })
}

export const sheetKey = (s: Sheet) => `${s.src}:${s.srcIndex}:${s.rot}`

async function ensure(s: Sheet, idx: SnapIndex) {
  const k = sheetKey(s)
  if (loaded.get(k) === idx) return k
  const segs = idx.segs.slice(0, idx.n * 4)
  await call('load', { key: k, segs, n: idx.n, w: s.width, h: s.height }, [segs.buffer])
  loaded.set(k, idx)
  return k
}

export interface FillResult {
  ok: boolean
  reason?: string
  outer?: Pt[]
  holes?: Pt[][]
  halfLine?: number
}
const toPts = (a: number[]) => {
  const out: Pt[] = []
  for (let i = 0; i < a.length; i += 2) out.push({ x: a[i], y: a[i + 1] })
  return out
}

export async function fillAt(s: Sheet, idx: SnapIndex, p: Pt, gap: number): Promise<FillResult> {
  const key = await ensure(s, idx)
  const r = await call<{ ok: boolean; reason?: string; outer?: number[]; holes?: number[][]; halfLine?: number }>('fill', { key, x: p.x, y: p.y, gap })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, outer: toPts(r.outer!), holes: r.holes!.map(toPts), halfLine: r.halfLine }
}

export async function findSymbols(target: Sheet, targetIdx: SnapIndex, source: Sheet, sourceIdx: SnapIndex, rect: { x: number; y: number; w: number; h: number }, rotations: boolean) {
  const key = await ensure(target, targetIdx)
  const srcKey = await ensure(source, sourceIdx)
  return call<{ ok: boolean; reason?: string; centers: [number, number][] }>('symbol', { key, srcKey, rect, rotations })
}

export async function findSymbolsRaster(gray: Uint8Array, W: number, H: number, k: number, rect: { x: number; y: number; w: number; h: number }) {
  return call<{ ok: boolean; centers: [number, number][] }>('raster', { gray, W, H, k, rect, thr: 0.78 }, [gray.buffer])
}
