import type { PDFPageProxy } from 'pdfjs-dist'
import type { Overlay, Pt, Sheet } from './types'

export type M6 = [number, number, number, number, number, number]
export const applyM = (m: M6, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })
export const invertM = ([a, b, c, d, e, f]: M6): M6 => {
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}
/** Semelhança (escala + rotação + translação) que leva o1→b1 e o2→b2. */
export function similarity(o1: Pt, o2: Pt, b1: Pt, b2: Pt): M6 {
  const so = Math.hypot(o2.x - o1.x, o2.y - o1.y), sb = Math.hypot(b2.x - b1.x, b2.y - b1.y)
  const s = sb / (so || 1)
  const th = Math.atan2(b2.y - b1.y, b2.x - b1.x) - Math.atan2(o2.y - o1.y, o2.x - o1.x)
  const a = s * Math.cos(th), b = s * Math.sin(th)
  return [a, b, -b, a, b1.x - (a * o1.x - b * o1.y), b1.y - (b * o1.x + a * o1.y)]
}

/** Folha "virtual" para a disciplina sobreposta (para renderizar e para o snap). */
export function overlaySheet(ov: Overlay, page: PDFPageProxy): Sheet {
  const vp = page.getViewport({ scale: 1, rotation: (page.rotate + ov.rot) % 360 })
  return { id: ov.id, src: ov.src, srcIndex: ov.srcIndex, baseRot: page.rotate, rot: ov.rot, label: ov.label, width: vp.width, height: vp.height }
}
