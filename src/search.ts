/** Busca de texto nas folhas (texto do PDF + palavras do OCR). */
import { useStore } from './store'
import { viewportOf } from './pdf'
import type { Sheet } from './types'

interface Item { text: string; norm: string; x: number; y: number; dx: number; dy: number; ux: number; uy: number; w: number; h: number }
const cache = new Map<string, Promise<Item[]>>()

export const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function itemsOf(sh: Sheet): Promise<Item[]> {
  const key = `${sh.src}:${sh.srcIndex}:${sh.rot}:${sh.baseRot}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const src = useStore.getState().sources[sh.src]
      const page = await src.doc.getPage(sh.srcIndex + 1)
      const vp = viewportOf(page, sh, 1)
      const tc = await page.getTextContent()
      const [a, b, c, d, e, f] = vp.transform
      const out: Item[] = []
      for (const it of tc.items) {
        if (!('str' in it) || !it.str.trim()) continue
        const [ta, tb, tcc, td, te, tf] = it.transform as number[]
        // matriz do texto no espaço da folha
        const m = [a * ta + c * tb, b * ta + d * tb, a * tcc + c * td, b * tcc + d * td, a * te + c * tf + e, b * te + d * tf + f]
        const sx = Math.hypot(m[0], m[1]) || 1
        const h = Math.hypot(m[2], m[3]) || 1
        const scale = sx / (Math.hypot(ta, tb) || 1)
        out.push({ text: it.str, norm: norm(it.str), x: m[4], y: m[5], dx: m[0] / sx, dy: m[1] / sx, ux: m[2] / h, uy: m[3] / h, w: it.width * scale, h })
      }
      return out
    })()
    cache.set(key, p)
  }
  return p
}

const rectOf = (it: Item, f0: number, f1: number) => {
  const pts = [f0, f1].flatMap((f) => [0, 1].map((u) => ({ x: it.x + it.dx * it.w * f + it.ux * it.h * u, y: it.y + it.dy * it.w * f + it.uy * it.h * u })))
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

let seq = 0
export async function runSearch(query: string) {
  const my = ++seq
  const st = useStore.getState()
  const q = norm(query.trim())
  if (q.length < 2) return useStore.setState({ search: { ...st.search, query, hits: [], index: 0 } })
  const hits: { sheet: string; x: number; y: number; w: number; h: number; text: string }[] = []
  // começa pela folha atual para mostrar o primeiro resultado mais perto
  const order = [...st.sheets.slice(st.page), ...st.sheets.slice(0, st.page)]
  for (const sh of order) {
    let items: Item[] = []
    try {
      items = await itemsOf(sh)
    } catch {
      /* página sem texto */
    }
    if (my !== seq) return
    for (const it of items) {
      let i = it.norm.indexOf(q)
      while (i >= 0) {
        const L = it.norm.length || 1
        hits.push({ sheet: sh.id, ...rectOf(it, i / L, (i + q.length) / L), text: it.text })
        i = it.norm.indexOf(q, i + q.length)
      }
    }
    for (const w of st.ocr[sh.id]?.words ?? []) if (norm(w.text).includes(q)) hits.push({ sheet: sh.id, x: w.x, y: w.y, w: w.w, h: w.h, text: w.text })
  }
  useStore.setState({ search: { open: true, query, hits, index: 0 } })
  if (hits.length) goTo(0)
}

export function goTo(index: number) {
  const st = useStore.getState()
  const n = st.search.hits.length
  if (!n) return
  const i = ((index % n) + n) % n
  const h = st.search.hits[i]
  const page = st.sheets.findIndex((s) => s.id === h.sheet)
  const switching = page !== st.page
  useStore.setState({ search: { ...st.search, index: i }, ...(switching ? { page, selected: [] } : {}) })
  setTimeout(() => window.dispatchEvent(new CustomEvent('traco:center', { detail: { x: h.x + h.w / 2, y: h.y + h.h / 2 } })), switching ? 180 : 0)
}
