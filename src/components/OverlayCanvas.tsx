import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { ocConfig } from '../pdf'
import type { Overlay } from '../types'
import { overlaySheet } from '../overlayMath'

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Desenha as disciplinas sobrepostas, coloridas (traço escuro → cor da disciplina, branco → transparente),
 * já transformadas para o sistema de coordenadas da folha base.
 */
export function OverlayCanvas({ overlays, w, h, k, left, top, cssW, cssH }: { overlays: Overlay[]; w: number; h: number; k: number; left: number; top: number; cssW: number; cssH: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sources = useStore((s) => s.sources)
  const hidden = useStore((s) => s.hiddenLayers)
  const sig = overlays.map((o) => `${o.id}:${o.visible}:${o.color}:${o.opacity}:${o.matrix.join(',')}:${o.rot}`).join('|')
  useEffect(() => {
    let alive = true
    const c = ref.current
    if (!c || !k) return
    const pw = Math.round(w * k), ph = Math.round(h * k)
    ;(async () => {
      const out = document.createElement('canvas')
      out.width = pw
      out.height = ph
      const octx = out.getContext('2d')!
      for (const ov of overlays) {
        if (!ov.visible) continue
        const src = sources[ov.src]
        if (!src) continue
        const page = await src.doc.getPage(ov.srcIndex + 1)
        const sh = overlaySheet(ov, page)
        const scale = Math.hypot(ov.matrix[0], ov.matrix[1]) * k // px por pt da folha sobreposta
        const vp = page.getViewport({ scale, rotation: (page.rotate + ov.rot) % 360 })
        const tmp = document.createElement('canvas')
        tmp.width = Math.ceil(vp.width)
        tmp.height = Math.ceil(vp.height)
        const tctx = tmp.getContext('2d')!
        const oc = await ocConfig(src)
        await page.render({ canvasContext: tctx, viewport: vp, ...(oc ? { optionalContentConfigPromise: Promise.resolve(oc) } : {}) }).promise
        if (!alive) return
        // colore: escuridão do traço → opacidade na cor da disciplina
        const img = tctx.getImageData(0, 0, tmp.width, tmp.height)
        const [r, g, b] = hex(ov.color)
        const d = img.data
        for (let i = 0; i < d.length; i += 4) {
          const dark = d[i + 3] ? 1 - (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255 : 0
          d[i] = r
          d[i + 1] = g
          d[i + 2] = b
          d[i + 3] = Math.min(255, dark * 255 * 1.4) * ov.opacity
        }
        tctx.putImageData(img, 0, 0)
        const m = ov.matrix
        octx.setTransform(k * m[0], k * m[1], k * m[2], k * m[3], k * m[4], k * m[5])
        octx.drawImage(tmp, 0, 0, sh.width, sh.height)
        octx.setTransform(1, 0, 0, 1, 0, 0)
      }
      if (!alive) return
      c.width = pw
      c.height = ph
      c.getContext('2d')!.drawImage(out, 0, 0)
    })()
    return () => {
      alive = false
    }
  }, [sig, k, w, h, hidden]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!overlays.some((o) => o.visible)) return null
  return <canvas ref={ref} className="overlay-disc" style={{ left, top, width: cssW, height: cssH }} />
}
