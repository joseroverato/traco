import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { zipSync } from 'fflate'
import { useStore } from './store'
import { layersOf, openSource, sheetRotation } from './pdf'
import { legendLayout, legendRows } from './components/LegendBox'
import type { Source } from './pdf'
import { arrowHead, bbox, centroid, cloudPoints, fmt, measureOf, scaleFor, signedArea, stampText } from './geometry'
import type { Markup, Preset, Pt, Sheet } from './types'

export interface ExportOptions {
  sheetIds?: string[] // padrão: todas, na ordem atual
  flatten: boolean // desenhar as marcações no PDF
  bookmarks: boolean // índice de folhas (marcadores do PDF)
  pageLabels: boolean // rótulos de página = nome da folha
  removeAnnots: boolean // remover anotações que já existiam no PDF
  meta: boolean
  /** só desenha as tarjas (usado depois da remoção definitiva no app de PC) */
  onlyRedacts?: boolean
  skipRedacts?: boolean
}

type M6 = [number, number, number, number, number, number]
const invert = ([a, b, c, d, e, f]: M6): M6 => {
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}
const apply = (m: M6, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })

const hex = (h: string) => {
  const n = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Fontes padrão do PDF só cobrem WinAnsi: troca o que não cabe. */
const safe = (t: string) =>
  t.replace(/→/g, '->').replace(/[−–]/g, '-').replace(/≈/g, '~').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\n\x20-\xFF€•…]/g, '?')

class Painter {
  private inv: M6
  private page: PDFPage
  private font: PDFFont
  private bold: PDFFont
  constructor(page: PDFPage, vpTransform: M6, font: PDFFont, bold: PDFFont) {
    this.inv = invert(vpTransform)
    this.page = page
    this.font = font
    this.bold = bold
  }
  map = (p: Pt) => apply(this.inv, p)
  private d(points: Pt[], closed: boolean) {
    return points.map((p, i) => { const q = this.map(p); return `${i ? 'L' : 'M'} ${q.x.toFixed(3)} ${(-q.y).toFixed(3)}` }).join(' ') + (closed ? ' Z' : '')
  }
  path(points: Pt[], o: { closed?: boolean; stroke?: string; width?: number; fill?: string; fillOpacity?: number; opacity?: number; dash?: number[]; holes?: Pt[][] }) {
    if (points.length < 2) return
    let d = this.d(points, !!o.closed)
    if (o.holes?.length) {
      // regra nonzero: o vazio precisa ter sentido oposto ao contorno
      const outer = Math.sign(signedArea(points))
      for (const h of o.holes) if (h.length > 2) d += ' ' + this.d(Math.sign(signedArea(h)) === outer ? [...h].reverse() : h, true)
    }
    this.page.drawSvgPath(d, {
      x: 0,
      y: 0,
      borderColor: o.stroke ? hex(o.stroke) : undefined,
      borderWidth: o.stroke ? o.width ?? 1 : 0,
      borderOpacity: o.opacity ?? 1,
      color: o.fill ? hex(o.fill) : undefined,
      opacity: o.fill ? (o.fillOpacity ?? 1) * (o.opacity ?? 1) : undefined,
      borderDashArray: o.dash,
      borderLineCap: 1,
    })
  }
  width(str: string, size: number, bold = false) {
    return (bold ? this.bold : this.font).widthOfTextAtSize(safe(str), size)
  }
  /** Texto ancorado em coordenadas de tela (viewport), direção dada em tela. */
  text(at: Pt, str: string, size: number, color: string, o: { dir?: Pt; bold?: boolean; align?: 'left' | 'center'; opacity?: number; halo?: boolean } = {}) {
    const f = o.bold ? this.bold : this.font
    const s = safe(str)
    const dir = o.dir ?? { x: 1, y: 0 }
    const w = f.widthOfTextAtSize(s, size)
    const start = o.align === 'center' ? { x: at.x - (dir.x * w) / 2, y: at.y - (dir.y * w) / 2 } : at
    if (o.halo) {
      const up = { x: dir.y, y: -dir.x }
      const pad = size * 0.25
      const c = (along: number, h: number) => ({ x: start.x + dir.x * along + up.x * h, y: start.y + dir.y * along + up.y * h })
      this.path([c(-pad, -size * 0.3), c(w + pad, -size * 0.3), c(w + pad, size * 0.95), c(-pad, size * 0.95)], { closed: true, fill: '#ffffff', fillOpacity: 0.85 })
    }
    const p0 = this.map(start)
    const p1 = this.map({ x: start.x + dir.x, y: start.y + dir.y })
    const ang = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI
    this.page.drawText(s, { x: p0.x, y: p0.y, size, font: f, color: hex(color), rotate: degrees(ang), opacity: o.opacity ?? 1 })
  }
  async image(dataUrl: string, a: Pt, b: Pt, doc: PDFDocument, opacity = 1) {
    const bb = bbox([a, b])
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0))
    const img = dataUrl.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    const p0 = this.map({ x: bb.x, y: bb.y + bb.h }) // canto inferior esquerdo visual
    const p1 = this.map({ x: bb.x + 1, y: bb.y + bb.h })
    const ang = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI
    this.page.drawImage(img, { x: p0.x, y: p0.y, width: bb.w, height: bb.h, rotate: degrees(ang), opacity })
  }
}

const circle = (c: Pt, r: number, n = 20): Pt[] => Array.from({ length: n }, (_, i) => ({ x: c.x + r * Math.cos((i / n) * 2 * Math.PI), y: c.y + r * Math.sin((i / n) * 2 * Math.PI) }))
const rotPt = (p: Pt, c: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180, dx = p.x - c.x, dy = p.y - c.y
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) }
}

async function paintMarkup(P: Painter, m: Markup, preset: Preset | undefined, ctx: { all: Markup[]; sheetScale: ReturnType<typeof scaleFor>; doc: PDFDocument; stamp: Parameters<typeof stampText>[1] }) {
  const [a, b] = m.points
  const dash = preset?.dash === 'dash' ? [m.width * 4, m.width * 2.5] : preset?.dash === 'dot' ? [m.width, m.width * 2] : undefined
  const q = measureOf(m, scaleFor(m, ctx.all, ctx.sheetScale), preset)
  const derived = !!preset && (!!preset.formula?.trim() || (preset.factor !== 1 && !!preset.factor))
  const label = (base: string) => (!q ? 'sem escala' : `${m.deduct ? '-' : ''}${fmt(q.raw)} ${base}${derived ? ` -> ${fmt(Math.abs(q.value))} ${q.unit}` : ''}`)
  switch (m.kind) {
    case 'rect':
    case 'ellipse':
    case 'cloud': {
      const bb = bbox([a, b])
      const pts =
        m.kind === 'rect'
          ? [{ x: bb.x, y: bb.y }, { x: bb.x + bb.w, y: bb.y }, { x: bb.x + bb.w, y: bb.y + bb.h }, { x: bb.x, y: bb.y + bb.h }]
          : m.kind === 'ellipse'
            ? Array.from({ length: 48 }, (_, i) => ({ x: bb.x + bb.w / 2 + (bb.w / 2) * Math.cos((i / 48) * 2 * Math.PI), y: bb.y + bb.h / 2 + (bb.h / 2) * Math.sin((i / 48) * 2 * Math.PI) }))
            : cloudPoints(a, b, 9)
      P.path(pts, { closed: true, stroke: m.color, width: m.width, fill: m.fillOpacity ? m.fill : undefined, fillOpacity: m.fillOpacity })
      break
    }
    case 'line':
    case 'arrow':
      P.path([a, b], { stroke: m.color, width: m.width })
      if (m.kind === 'arrow') P.path(arrowHead(a, b, Math.max(8, m.width * 5)), { stroke: m.color, width: m.width })
      break
    case 'text': {
      const bb = bbox([a, b])
      P.path([{ x: bb.x, y: bb.y }, { x: bb.x + bb.w, y: bb.y }, { x: bb.x + bb.w, y: bb.y + bb.h }, { x: bb.x, y: bb.y + bb.h }], { closed: true, stroke: m.color, width: m.width, fill: '#ffffff', fillOpacity: 0.92 })
      const lines = wrap(m.text, m.fontSize, bb.w - 8)
      lines.forEach((ln, i) => P.text({ x: bb.x + 4, y: bb.y + 4 + m.fontSize * (0.9 + i * 1.25) }, ln, m.fontSize, m.color))
      break
    }
    case 'stamp': {
      const bb = bbox([a, b])
      const c = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 }
      const ang = m.angle ?? 0
      const op = m.opacity ?? 1
      if (m.width) {
        const corners = [{ x: bb.x, y: bb.y }, { x: bb.x + bb.w, y: bb.y }, { x: bb.x + bb.w, y: bb.y + bb.h }, { x: bb.x, y: bb.y + bb.h }].map((p) => rotPt(p, c, ang))
        P.path(corners, { closed: true, stroke: m.color, width: m.width, opacity: op })
      }
      const lines = stampText(m.text, ctx.stamp).split('\n')
      const rad = (ang * Math.PI) / 180
      const dir = { x: Math.cos(rad), y: Math.sin(rad) }
      const down = { x: -Math.sin(rad), y: Math.cos(rad) }
      lines.forEach((ln, i) => {
        const off = (i - (lines.length - 1) / 2) * m.fontSize * 1.2 + m.fontSize * 0.35
        P.text({ x: c.x + down.x * off, y: c.y + down.y * off }, ln, m.fontSize, m.color, { dir, bold: true, align: 'center', opacity: op })
      })
      break
    }
    case 'image':
      if (m.image) await P.image(m.image, a, b, ctx.doc, m.opacity ?? 1)
      break
    case 'length':
      P.path(m.points, { stroke: m.color, width: m.width, dash, opacity: m.deduct ? 0.55 : 1 })
      if (m.points.length > 1 && (preset?.showLabel ?? true)) {
        let best = 0, bi = 1
        for (let i = 1; i < m.points.length; i++) {
          const L = Math.hypot(m.points[i].x - m.points[i - 1].x, m.points[i].y - m.points[i - 1].y)
          if (L > best) { best = L; bi = i }
        }
        P.text({ x: (m.points[bi].x + m.points[bi - 1].x) / 2, y: (m.points[bi].y + m.points[bi - 1].y) / 2 - 4 }, label('m'), 7, m.color, { bold: true, align: 'center', halo: true })
      }
      break
    case 'area':
      P.path(m.points, { closed: true, holes: m.holes, stroke: m.color, width: m.width, dash: m.deduct ? [m.width * 3, m.width * 2] : dash, fill: m.deduct || preset?.pattern === 'none' ? undefined : m.fill, fillOpacity: m.fillOpacity })
      if (m.points.length > 2 && (preset?.showLabel ?? true)) P.text(centroid(m.points), label('m²'), 7, m.color, { bold: true, align: 'center', halo: true })
      break
    case 'space': {
      P.path(m.points, { closed: true, holes: m.holes, stroke: m.color, width: m.width || 1, dash: [4, 3], fill: m.color, fillOpacity: 0.07 })
      if (m.points.length > 2) {
        const c = centroid(m.points)
        P.text({ x: c.x, y: c.y - 2 }, m.text || 'Ambiente', 8, m.color, { bold: true, align: 'center', halo: true })
        if (q) P.text({ x: c.x, y: c.y + 8 }, `${fmt(q.vars.A)} m²`, 7, m.color, { align: 'center', halo: true })
      }
      break
    }
    case 'legend': {
      const rows = legendRows(m)
      const L = legendLayout(m, rows)
      const box = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]
      P.path(box(L.x, L.y, L.w, L.h), { closed: true, fill: '#ffffff', fillOpacity: 1, stroke: '#1f2937', width: 0.8 })
      P.path(box(L.x, L.y, L.w, L.head), { closed: true, fill: '#1f2937', fillOpacity: 1 })
      P.text({ x: L.x + L.fs * 0.6, y: L.y + L.head * 0.62 }, `QUANTITATIVO ${m.legend?.scope === 'all' ? '- PROJETO' : '- FOLHA'}`, L.fs * 1.05, '#ffffff', { bold: true })
      const colQ = L.x + L.w * (L.prices ? 0.62 : 0.78)
      const right = (x: number, y: number, s: string, bold = false) => P.text({ x: x - P.width(s, L.fs, bold), y }, s, L.fs, '#111827', { bold })
      if (!rows.length) P.text({ x: L.x + L.fs * 0.6, y: L.y + L.head + L.lh * 0.7 }, 'Sem medições', L.fs, '#6b7280')
      rows.forEach((r, i) => {
        const y = L.y + L.head + i * L.lh
        if (i % 2 === 1) P.path(box(L.x + 0.4, y, L.w - 0.8, L.lh), { closed: true, fill: '#f3f4f6', fillOpacity: 1 })
        P.path(box(L.x + L.fs * 0.6, y + L.lh * 0.25, L.fs * 1.2, L.lh * 0.5), { closed: true, fill: r.color, fillOpacity: 0.8 })
        P.text({ x: L.x + L.fs * 2.3, y: y + L.lh * 0.66 }, r.name.length > 48 ? r.name.slice(0, 46) + '...' : r.name, L.fs, '#111827')
        right(colQ, y + L.lh * 0.66, `${fmt(r.qty)} ${r.unit}`, true)
        if (L.prices) right(L.x + L.w - L.fs * 0.6, y + L.lh * 0.66, r.price ? `R$ ${fmt(r.total)}` : '-')
      })
      if (L.prices) right(L.x + L.w - L.fs * 0.6, L.y + L.head + rows.length * L.lh + L.lh * 0.7, `Total R$ ${fmt(rows.reduce((t, r) => t + r.total, 0))}`, true)
      break
    }
    case 'count': {
      m.points.forEach((p, i) => {
        P.path(circle(p, 5), { closed: true, fill: m.color, fillOpacity: 0.85, stroke: '#ffffff', width: 0.6 })
        const t = preset?.letter || (preset?.symbol === 'letter' ? '' : String(i + 1))
        if (t) P.text({ x: p.x, y: p.y + 2.2 }, t, 6, '#ffffff', { bold: true, align: 'center' })
      })
      const last = m.points[m.points.length - 1]
      if (last && (preset?.showLabel ?? true)) P.text({ x: last.x + 9, y: last.y - 7 }, `${m.points.length} un`, 7, m.color, { bold: true, halo: true })
      break
    }
    case 'redact': {
      const bb = bbox([a, b])
      P.path([{ x: bb.x, y: bb.y }, { x: bb.x + bb.w, y: bb.y }, { x: bb.x + bb.w, y: bb.y + bb.h }, { x: bb.x, y: bb.y + bb.h }], { closed: true, fill: m.fill || '#000000', fillOpacity: 1 })
      if (m.text) P.text({ x: bb.x + 2, y: bb.y + bb.h / 2 + m.fontSize * 0.35 }, m.text, m.fontSize, m.fill === '#000000' ? '#ffffff' : '#000000')
      break
    }
    default:
      break // viewport: auxiliar de trabalho, não vai para o PDF
  }
}

function wrap(text: string, size: number, width: number) {
  const out: string[] = []
  const per = Math.max(4, Math.floor(width / (size * 0.5)))
  for (const para of (text || '').split('\n')) {
    let line = ''
    for (const w of para.split(' ')) {
      if ((line + ' ' + w).trim().length > per && line) { out.push(line); line = w } else line = (line + ' ' + w).trim()
    }
    out.push(line)
  }
  return out
}

function addOutline(doc: PDFDocument, entries: { title: string; page: PDFRef }[]) {
  const ctx = doc.context
  const rootRef = ctx.nextRef()
  const refs = entries.map(() => ctx.nextRef())
  entries.forEach((e, i) => {
    const dest = PDFArray.withContext(ctx)
    dest.push(e.page)
    dest.push(PDFName.of('Fit'))
    const d = ctx.obj({}) as PDFDict
    d.set(PDFName.of('Title'), PDFHexString.fromText(e.title))
    d.set(PDFName.of('Parent'), rootRef)
    d.set(PDFName.of('Dest'), dest)
    if (i > 0) d.set(PDFName.of('Prev'), refs[i - 1])
    if (i < refs.length - 1) d.set(PDFName.of('Next'), refs[i + 1])
    ctx.assign(refs[i], d)
  })
  const root = ctx.obj({}) as PDFDict
  root.set(PDFName.of('Type'), PDFName.of('Outlines'))
  if (refs.length) {
    root.set(PDFName.of('First'), refs[0])
    root.set(PDFName.of('Last'), refs[refs.length - 1])
    root.set(PDFName.of('Count'), PDFNumber.of(refs.length))
  }
  ctx.assign(rootRef, root)
  doc.catalog.set(PDFName.of('Outlines'), rootRef)
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

/** Recria as camadas (OCG) no PDF exportado, com as ocultas no app desligadas. */
async function addLayers(doc: PDFDocument, sheets: Sheet[]) {
  const st = useStore.getState()
  const hiddenNames = new Set<string>()
  for (const id of new Set(sheets.map((s) => s.src))) {
    const hidden = st.hiddenLayers[id] ?? []
    if (!hidden.length) continue
    for (const l of await layersOf(st.sources[id])) if (hidden.includes(l.id)) hiddenNames.add(l.name)
  }
  const all: PDFRef[] = []
  const off: PDFRef[] = []
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.get(PDFName.of('Type')) !== PDFName.of('OCG')) continue
    all.push(ref)
    const n = obj.get(PDFName.of('Name'))
    const name = n instanceof PDFString || n instanceof PDFHexString ? n.decodeText() : ''
    if (hiddenNames.has(name)) off.push(ref)
  }
  if (!all.length) return
  const ctx = doc.context
  const arr = (refs: PDFRef[]) => { const a = PDFArray.withContext(ctx); refs.forEach((r) => a.push(r)); return a }
  const d = ctx.obj({}) as PDFDict
  d.set(PDFName.of('Order'), arr(all))
  d.set(PDFName.of('ON'), arr(all.filter((r) => !off.includes(r))))
  d.set(PDFName.of('OFF'), arr(off))
  const oc = ctx.obj({}) as PDFDict
  oc.set(PDFName.of('OCGs'), arr(all))
  oc.set(PDFName.of('D'), d)
  doc.catalog.set(PDFName.of('OCProperties'), oc)
}

function addPageLabels(doc: PDFDocument, labels: string[]) {
  const ctx = doc.context
  const nums = PDFArray.withContext(ctx)
  labels.forEach((l, i) => {
    nums.push(PDFNumber.of(i))
    const d = ctx.obj({}) as PDFDict
    d.set(PDFName.of('P'), PDFHexString.fromText(l))
    nums.push(d)
  })
  const tree = ctx.obj({}) as PDFDict
  tree.set(PDFName.of('Nums'), nums)
  doc.catalog.set(PDFName.of('PageLabels'), ctx.register(tree))
}

export async function buildPdf(opts: ExportOptions): Promise<Uint8Array> {
  const st = useStore.getState()
  const sheets = opts.sheetIds ? opts.sheetIds.map((id) => st.sheets.find((s) => s.id === id)!).filter(Boolean) : st.sheets
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const cache = new Map<string, PDFDocument>()
  const presetById = Object.fromEntries(st.presets.map((p) => [p.id, p]))
  const refs: PDFRef[] = []
  for (const [i, sh] of sheets.entries()) {
    const src = st.sources[sh.src]
    let srcDoc = cache.get(sh.src)
    if (!srcDoc) {
      srcDoc = await PDFDocument.load(src.bytes, { ignoreEncryption: true })
      cache.set(sh.src, srcDoc)
    }
    const [pg] = await out.copyPages(srcDoc, [sh.srcIndex])
    if (!opts.onlyRedacts) pg.setRotation(degrees(sheetRotation(sh)))
    if (opts.removeAnnots) pg.node.delete(PDFName.of('Annots'))
    out.addPage(pg)
    refs.push(pg.ref)
    if (opts.flatten) {
      const proxy = await src.doc.getPage(sh.srcIndex + 1)
      const vp = proxy.getViewport({ scale: 1, rotation: sheetRotation(sh) })
      const painter = new Painter(pg, vp.transform as M6, font, bold)
      const ms = st.markups.filter((m) => m.page === sh.id && (opts.onlyRedacts ? m.kind === 'redact' : !(opts.skipRedacts && m.kind === 'redact')))
      const stamp = { n: i + 1, total: sheets.length, label: sh.label, file: st.fileName, author: st.author }
      for (const m of ms) await paintMarkup(painter, m, m.presetId ? presetById[m.presetId] : undefined, { all: ms, sheetScale: st.scales[sh.id], doc: out, stamp })
    }
  }
  await addLayers(out, sheets)
  if (opts.bookmarks) addOutline(out, sheets.map((s, i) => ({ title: s.label, page: refs[i] })))
  if (opts.pageLabels) addPageLabels(out, sheets.map((s) => s.label))
  if (opts.meta) {
    const m = st.meta
    if (m.title) out.setTitle(m.title)
    if (m.author) out.setAuthor(m.author)
    if (m.subject) out.setSubject(m.subject)
    if (m.keywords) out.setKeywords(m.keywords.split(/[;,]/).map((k) => k.trim()).filter(Boolean))
  }
  out.setProducer('Traço')
  out.setCreator('Traço — revisão e quantitativo')
  return out.save()
}

/** Divide o conjunto em vários PDFs e entrega um .zip. */
export async function splitToZip(groups: { name: string; ids: string[] }[], base: Omit<ExportOptions, 'sheetIds'>) {
  const files: Record<string, Uint8Array> = {}
  for (const g of groups) files[`${g.name}.pdf`] = await buildPdf({ ...base, sheetIds: g.ids })
  return zipSync(files, { level: 0 })
}

/** Cria uma folha em branco (fonte própria) no tamanho indicado em pt. */
export async function blankSource(w: number, h: number, name = 'Folha em branco'): Promise<Source> {
  const d = await PDFDocument.create()
  d.addPage([w, h])
  const bytes = await d.save()
  return openSource(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, name)
}

export const PAPER: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
  A2: [1190.55, 1683.78],
  A1: [1683.78, 2383.94],
  A0: [2383.94, 3370.39],
}

/**
 * Exporta com o melhor motor disponível.
 * App de PC: tarja definitiva (MuPDF remove texto/imagens sob a tarja) e otimização.
 * Navegador: tarja visual e PDF sem otimização extra.
 */
export async function exportPdf(opts: ExportOptions & { optimize?: boolean }): Promise<Uint8Array> {
  const { desktop } = await import('./platform')
  const st = useStore.getState()
  const ids = opts.sheetIds ?? st.sheets.map((s) => s.id)
  const redacts = opts.flatten ? st.markups.filter((m) => m.kind === 'redact' && ids.includes(m.page)) : []
  if (!desktop) return buildPdf(opts)
  let bytes = await buildPdf({ ...opts, skipRedacts: redacts.length > 0 })
  if (redacts.length) {
    const items = redacts.map((m) => {
      const b = bbox(m.points)
      return { page: ids.indexOf(m.page), rect: [b.x, b.y, b.x + b.w, b.y + b.h] as [number, number, number, number], fill: [0, 0, 0] as [number, number, number] }
    })
    bytes = await desktop.engine.redact(bytes, items)
    bytes = await overlayRedacts(bytes, ids)
  }
  if (opts.optimize) bytes = await desktop.engine.optimize(bytes)
  return bytes
}

/** Redesenha as tarjas (com cor e texto de substituição) sobre o PDF já limpo. */
async function overlayRedacts(bytes: Uint8Array, ids: string[]) {
  const st = useStore.getState()
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  for (const [i, id] of ids.entries()) {
    const ms = st.markups.filter((m) => m.page === id && m.kind === 'redact')
    if (!ms.length) continue
    const sh = st.sheets.find((s) => s.id === id)!
    const proxy = await st.sources[sh.src].doc.getPage(sh.srcIndex + 1)
    const vp = proxy.getViewport({ scale: 1, rotation: sheetRotation(sh) })
    const painter = new Painter(doc.getPage(i), vp.transform as M6, font, bold)
    for (const m of ms) await paintMarkup(painter, m, undefined, { all: ms, sheetScale: undefined, doc, stamp: { n: i + 1, total: ids.length, label: sh.label, file: st.fileName, author: st.author } })
  }
  return doc.save()
}

export type { Sheet }
