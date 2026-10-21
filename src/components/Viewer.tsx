import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import { curSheet, useStore } from '../store'
import { detectScales, layerKey } from '../pdf'
import type { Markup, MarkupKind, Pt } from '../types'
import { MarkupShape, PatternDefs } from './MarkupShape'
import { bbox, dist, scaleFor, snapAngle } from '../geometry'
import { DRAWING_TOOLS, computeLayout, markupsInRect, snapAllowed } from '../viewerLogic'
import { useElementSize, usePageRender, useZoomControls } from './viewerHooks'
import { buildDraft, commitDraw, commitFill, commitPolygon, minVertices, placeAt } from '../viewerActions'
import { Magnet, Move } from 'lucide-react'
import { fillAt, findSymbols, reasonText } from '../geoWorker'
import { OverlayCanvas } from './OverlayCanvas'
import { applyM, invertM, overlaySheet, similarity } from '../overlayMath'
import { LegendBox } from './LegendBox'
import { SymbolResult } from './SymbolResult'
import { findSnap, snapIndexFor } from '../snap'
import { SnapMarker } from './SnapMarker'
import { ViewerHints } from './ViewerHints'
import { ScaleBanner } from './ScaleBanner'
import { openSample } from '../tour'
import { ViewerEmpty } from './ViewerEmpty'
import { AlignPoints, DashedRect, SearchHighlights, SelectionHandles, SymbolMatches } from './ViewerOverlays'
import { TextEditor } from './TextEditor'
import { filterHoles, refineRing } from '../regions'
import type { SnapHit, SnapIndex } from '../snap'
import { t } from '../i18n'
import { useIsMobile } from '../mobile'
import { isMiraTool, useMira } from '../mira'


type Drag =
  | { type: 'draw'; kind: MarkupKind | 'calibrate'; start: Pt }
  | { type: 'move'; ids: string[]; start: Pt; orig: Record<string, Pt[]>; holes: Record<string, Pt[][] | undefined>; moved: boolean }
  | { type: 'symbol'; start: Pt }
  | { type: 'handle'; id: string; idx: number; moved: boolean }
  | { type: 'pan'; sx: number; sy: number; sl: number; st: number }
  | { type: 'marquee'; start: Pt }

const TWO_POINT: Array<MarkupKind | 'calibrate'> = ['rect', 'ellipse', 'cloud', 'arrow', 'line', 'viewport', 'redact', 'calibrate']

export function Viewer({ onOpen }: { onOpen: () => void }) {
  const s = useStore()
  const { zoom, tool } = s
  const sheet = curSheet(s)
  const info = sheet
  const page = sheet?.id ?? ''
  const doc = sheet ? s.sources[sheet.src]?.doc : undefined
  const box = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)
  const detailRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [proxy, setProxy] = useState<PDFPageProxy | null>(null)
  const drag = useRef<Drag | null>(null)
  const space = useRef(false)
  const countId = useRef<string | null>(null)
  const [draft, setDraft] = useState<Markup | null>(null)
  const [poly, setPoly] = useState<{ kind: 'length' | 'area' | 'hole' | 'space' | 'solid'; points: Pt[]; hover: Pt | null } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [symRect, setSymRect] = useState<{ a: Pt; b: Pt } | null>(null)
  const [symFound, setSymFound] = useState<{ rect: { x: number; y: number; w: number; h: number }; centers: Pt[] } | null>(null)
  const ovIdx = useRef<Record<string, SnapIndex>>({})
  const [marquee, setMarquee] = useState<{ a: Pt; b: Pt } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [, force] = useState(0)
  const snapIdx = useRef<SnapIndex | null>(null)
  const [snapHit, setSnapHit] = useState<SnapHit | null>(null)
  const [snapState, setSnapState] = useState<'off' | 'loading' | 'ready'>('off')
  const panRaf = useRef(0)
  const [found, setFound] = useState<{ sheet: string; n: number | null; hidden: boolean } | null>(null)
  const prompted = useRef(new Set<string>())
  const mobile = useIsMobile()
  // celular: ferramentas de medição usam a mira fixa no centro (ver mira.ts)
  const mira = mobile && isMiraTool(tool)
  const [calStart, setCalStart] = useState<Pt | null>(null)
  const miraPt = useRef<Pt | null>(null)

  // ---------- layout ----------
  const hasDoc = !!doc
  const size = useElementSize(box, hasDoc)
  const layoutFor = useCallback((z: number) => computeLayout(info, size, z), [info, size])
  const L = layoutFor(zoom)

  // ---------- página ----------
  useEffect(() => {
    let alive = true
    setProxy(null)
    if (doc && sheet) doc.getPage(sheet.srcIndex + 1).then((p) => alive && setProxy(p))
    setPoly(null)
    countId.current = null
    return () => {
      alive = false
    }
  }, [doc, page, sheet?.rot]) // eslint-disable-line react-hooks/exhaustive-deps

  const { zoomAt } = useZoomControls({ box, hasDoc, info, doc, page, size, zoom, layoutFor })

  // escala escrita no carimbo da folha (para os avisos "folha sem escala" e "escala diferente do carimbo")
  useEffect(() => {
    if (!sheet) return
    let alive = true
    detectScales(s.sources[sheet.src], sheet.srcIndex).then((f) => alive && setFound({ sheet: sheet.id, n: f[0] ?? null, hidden: false }))
    return () => {
      alive = false
    }
  }, [sheet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // estilo Revu: ao escolher uma ferramenta de medição numa folha sem escala, oferece calibrar
  useEffect(() => {
    if (!sheet || (tool !== 'length' && tool !== 'area')) return
    const st = useStore.getState()
    const hasScale = !!st.scales[sheet.id] || st.markups.some((m) => m.kind === 'viewport' && m.page === sheet.id && m.scale)
    if (hasScale || st.calibrating || prompted.current.has(sheet.id)) return
    prompted.current.add(sheet.id)
    st.set({ calibrating: { page: sheet.id, length: 0, prompt: true }, resumeTool: tool })
  }, [tool, sheet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- renderização ----------
  const lk = sheet ? layerKey(sheet.src) : ''
  const src = sheet ? s.sources[sheet.src] : undefined
  useEffect(() => {
    baseScale.current = 0
    if (baseRef.current) baseRef.current.width = 0
    snapIdx.current = null
    setSnapHit(null)
    if (!proxy || !sheet) return setSnapState('off')
    let alive = true
    setSnapState('loading')
    // geometria vetorial da folha para o snap (em segundo plano)
    snapIndexFor(proxy, sheet, src).then((idx) => {
      if (!alive) return
      snapIdx.current = idx
      setSnapState('ready')
    }).catch(() => alive && setSnapState('off'))
    return () => {
      alive = false
    }
  }, [proxy, lk]) // eslint-disable-line react-hooks/exhaustive-deps

  // índices de snap das disciplinas sobrepostas (para alinhar por pontos)
  const overlays = sheet ? s.overlays[sheet.id] ?? [] : []
  useEffect(() => {
    for (const ov of overlays) {
      if (ovIdx.current[ov.id]) continue
      const so = s.sources[ov.src]
      if (!so) continue
      so.doc.getPage(ov.srcIndex + 1).then((pg) => snapIndexFor(pg, overlaySheet(ov, pg), so).then((idx) => (ovIdx.current[ov.id] = idx)))
    }
  }, [overlays.map((o) => o.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  const { baseScale, onScroll } = usePageRender({ box, baseRef, detailRef, proxy, info, src, lk, zoom, layoutFor })

  // ---------- teclado (desenho em andamento) ----------
  // o polígono em andamento vem de uma referência: criar a marcação dentro do atualizador de estado
  // rodava duas vezes no StrictMode (duplicava o desenho em desenvolvimento)
  const polyRef = useRef(poly)
  polyRef.current = poly
  const finishPoly = useCallback(() => {
    const pl = polyRef.current
    if (!pl) return
    setPoly(null)
    polyRef.current = null // Enter + duplo clique no mesmo instante não criam duas vezes
    if (pl.points.length >= minVertices(pl.kind)) commitPolygon(pl.kind, page, pl.points)
  }, [page])

  /** Área por clique: contorno fechado pelas linhas do PDF ao redor do ponto. */
  const doFill = async (p: Pt, asHole: boolean) => {
    const st = useStore.getState()
    if (!sheet || !snapIdx.current) return st.notify(t('viewer.aguarde_lendo_as_linhas_da'))
    setBusy(t('viewer.detectando_contorno'))
    try {
      const r = await fillAt(sheet, snapIdx.current, p, st.fillGap)
      if (!r.ok) return st.notify(reasonText(r.reason) ?? t('viewer.nao_foi_possivel_detectar_o'))
      const refine = (ring: Pt[]) => refineRing(snapIdx.current, ring, r.halfLine ?? 1)
      const outer = refine(r.outer!)
      const holes = filterHoles(page, r.holes!.map(refine).filter((h) => h.length >= 3))
      if (outer.length < 3) return st.notify(t('viewer.contorno_muito_pequeno'))
      commitFill(page, outer, holes, asHole)
    } finally {
      setBusy(null)
    }
  }

  /** Contagem automática: procura cópias do símbolo selecionado na folha. */
  const doSymbol = async (rect: { x: number; y: number; w: number; h: number }) => {
    const st = useStore.getState()
    if (!sheet || !snapIdx.current) return
    setBusy(t('viewer.procurando_simbolos'))
    try {
      const r = await findSymbols(sheet, snapIdx.current, sheet, snapIdx.current, rect, true)
      if (!r.ok) {
        if (r.reason === 'vector-empty') {
          const { findSymbolsRasterOn } = await import('../symbolRaster')
          const centers = await findSymbolsRasterOn(sheet, rect)
          setSymFound({ rect, centers })
          return
        }
        return st.notify(reasonText(r.reason) ?? t('viewer.nada_encontrado'))
      }
      setSymFound({ rect, centers: r.centers.map(([x, y]) => ({ x, y })) })
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input,textarea,select,[contenteditable]')) return
      // como no AutoCAD: com um traçado em andamento, Espaço = Enter (termina o polígono/medição); sem traçado, segurar Espaço move a vista
      if (e.code === 'Space' && poly && poly.points.length) {
        e.preventDefault()
        if (!e.repeat) finishPoly()
        return
      }
      if (e.code === 'Space' && !space.current) {
        space.current = true
        force((n) => n + 1)
      }
      if (e.key === 'Enter') finishPoly()
      if (e.key === 'Escape') {
        if (useStore.getState().aligning) useStore.setState({ aligning: null })
        setSymFound(null)
        if (poly) setPoly(null)
        countId.current = null
        setDraft(null)
        drag.current = null
      }
      if (e.key === 'Backspace' && poly) {
        e.preventDefault()
        setPoly({ ...poly, points: poly.points.slice(0, -1) })
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        space.current = false
        force((n) => n + 1)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [poly, finishPoly])

  useEffect(() => {
    setPoly(null)
    setDraft(null)
    setCalStart(null)
    countId.current = null
  }, [tool, s.activePreset])

  // ---------- pan (botão do meio, Espaço ou ferramenta Mão) ----------
  const onPanDown = (e: React.PointerEvent) => {
    if (!(e.button === 1 || (e.button === 0 && (space.current || tool === 'pan' || mira)))) return
    e.preventDefault()
    e.stopPropagation()
    const el = box.current!
    el.setPointerCapture(e.pointerId)
    drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.classList.add('panning')
  }
  const onPanMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (d?.type !== 'pan') return
    const x = d.sl - (e.clientX - d.sx), y = d.st - (e.clientY - d.sy)
    cancelAnimationFrame(panRaf.current)
    panRaf.current = requestAnimationFrame(() => {
      const el = box.current
      if (!el) return
      el.scrollLeft = x
      el.scrollTop = y
    })
  }
  const onPanUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (d?.type !== 'pan') return
    drag.current = null
    try {
      box.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* o ponteiro já foi solto */
    }
    box.current?.classList.remove('panning')
    // celular, mão selecionada: um toque (sem arrastar) numa marcação a seleciona; num vazio, limpa a seleção
    if (mobile && tool === 'pan' && e.button === 0 && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) {
      // a ponta do dedo não acerta uma linha fina: testa o ponto e anéis de até ~16 px ao redor (do mais perto para o mais longe)
      const probes: [number, number][] = [[0, 0]]
      for (const r of [5, 10, 16]) for (let a = 0; a < 12; a++) probes.push([Math.cos((a * Math.PI) / 6) * r, Math.sin((a * Math.PI) / 6) * r])
      let hit: SVGElement | null = null
      for (const [dx, dy] of probes) {
        hit = (document.elementsFromPoint(e.clientX + dx, e.clientY + dy).map((n) => n.closest('[data-id]') as SVGElement | null).find((n) => n && n.dataset.id !== '__draft') ?? null)
        if (hit) break
      }
      const st = useStore.getState()
      if (hit) st.set({ selected: [hit.dataset.id!] })
      else if (st.selected.length) st.set({ selected: [] })
    }
  }

  // ---------- ponteiro ----------
  const toPage = (e: React.PointerEvent | React.MouseEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
  }

  /** Aplica snap (geometria do PDF e vértices) e trava de ângulo (Shift 45° / Ortho 90°). */
  const resolve = (raw: Pt, e: { shiftKey: boolean; altKey: boolean }, prev?: Pt, exclude?: string): Pt => {
    const st = useStore.getState()
    let hit: SnapHit | null = null
    if (snapAllowed(tool, st.snap, e.altKey)) {
      const verts: Pt[] = []
      for (const m of st.markups)
        if (m.page === page && m.id !== exclude && m.kind !== 'viewport' && m.kind !== 'legend') {
          for (const q of m.points) verts.push(q)
          for (const h of m.holes ?? []) for (const q of h) verts.push(q)
        }
      if (poly) verts.push(...poly.points.slice(0, 1))
      hit = findSnap(snapIdx.current, raw, 10 / zoom, verts.slice(0, 4000))
    }
    const strong = hit && hit.kind !== 'nearest'
    let q = strong ? hit!.pt : raw
    if (!strong && prev && (e.shiftKey || st.ortho)) {
      q = e.shiftKey ? snapAngle(prev, raw) : Math.abs(raw.x - prev.x) >= Math.abs(raw.y - prev.y) ? { x: raw.x, y: prev.y } : { x: prev.x, y: raw.y }
      hit = null
    } else if (hit && !strong) q = hit.pt
    setSnapHit(hit ? { ...hit, pt: q } : null)
    return q
  }
  const DRAWING = DRAWING_TOOLS

  const mkDraft = (kind: MarkupKind | 'calibrate', pts: Pt[]): Markup => buildDraft(kind, pts, page, zoom)

  /** Alinhar disciplina: ponto no desenho sobreposto → mesmo ponto na base (2 pares). */
  const alignClick = (raw: Pt, e: React.PointerEvent) => {
    const st = useStore.getState()
    const a = st.aligning!
    const ov = (st.overlays[page] ?? []).find((o) => o.id === a.overlay)
    if (!ov) return st.set({ aligning: null })
    let q: Pt
    if (a.step % 2 === 0) {
      // ponto do desenho sobreposto: snap na geometria dele (em coordenadas próprias)
      const inv = invertM(ov.matrix)
      const local = applyM(inv, raw)
      const sc = Math.hypot(ov.matrix[0], ov.matrix[1]) || 1
      const hit = !e.altKey && ovIdx.current[ov.id] ? findSnap(ovIdx.current[ov.id], local, 10 / zoom / sc, []) : null
      q = hit && hit.kind !== 'nearest' ? hit.pt : local
    } else q = resolve(raw, e)
    const pts = [...a.pts, q]
    if (pts.length < 4) return st.set({ aligning: { ...a, step: a.step + 1, pts } })
    const m = similarity(pts[0], pts[2], pts[1], pts[3])
    st.set({ aligning: null, overlays: { ...st.overlays, [page]: (st.overlays[page] ?? []).map((o) => (o.id === ov.id ? { ...o, matrix: m } : o)) } })
    st.notify(t('viewer.alinhada_escala', { label: ov.label, toFixed: (Math.hypot(m[0], m[1]) * 100).toFixed(1) }))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!info) return
    const st = useStore.getState()
    if (e.button !== 0 || space.current || tool === 'pan') return // pan é tratado pela área toda
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const raw = toPage(e)
    const lastPt = poly?.points[poly.points.length - 1]
    const p = DRAWING.includes(tool) ? resolve(raw, e, lastPt) : raw
    if (st.aligning) return alignClick(raw, e)
    if (tool === 'fill') return void doFill(raw, e.shiftKey)
    if (tool === 'symbol') {
      drag.current = { type: 'symbol', start: raw }
      setSymRect({ a: raw, b: raw })
      return
    }
    if (tool === 'legend') {
      placeAt('legend', page, raw)
      return
    }
    const target = e.target as Element
    const handle = target.closest('[data-handle]') as SVGElement | null
    const hitId = (target.closest('[data-id]') as SVGElement | null)?.dataset.id

    if (tool === 'select') {
      if (handle) {
        drag.current = { type: 'handle', id: handle.dataset.mid!, idx: Number(handle.dataset.handle), moved: false }
        return
      }
      if (hitId && hitId !== '__draft') {
        let sel = st.selected
        if (e.shiftKey) sel = sel.includes(hitId) ? sel.filter((x) => x !== hitId) : [...sel, hitId]
        else if (!sel.includes(hitId)) sel = [hitId]
        st.set({ selected: sel })
        const orig: Record<string, Pt[]> = {}
        const holes: Record<string, Pt[][] | undefined> = {}
        st.markups.filter((m) => sel.includes(m.id)).forEach((m) => { orig[m.id] = m.points; holes[m.id] = m.holes })
        drag.current = { type: 'move', ids: sel, start: p, orig, holes, moved: false }
        return
      }
      if (!e.shiftKey) st.set({ selected: [] })
      drag.current = { type: 'marquee', start: p }
      setMarquee({ a: p, b: p })
      return
    }

    if (TWO_POINT.includes(tool as MarkupKind)) {
      drag.current = { type: 'draw', kind: tool as MarkupKind, start: p }
      setDraft(mkDraft(tool as MarkupKind, [p, p]))
      return
    }
    if (tool === 'stamp') {
      e.preventDefault()
      placeAt('stamp', page, p)
      return
    }
    if (tool === 'image') {
      const img = st.pendingImage
      if (!img) {
        window.dispatchEvent(new CustomEvent('traco:pick-image'))
        return
      }
      const im = new Image()
      im.onload = () => {
        const w = 160, h = (160 * im.height) / im.width
        useStore.getState().addMarkup('image', page, [{ x: p.x, y: p.y }, { x: p.x + w, y: p.y + h }], { image: img })
        useStore.setState({ tool: 'select', pendingImage: null })
      }
      im.src = img
      return
    }
    if (tool === 'text') {
      e.preventDefault() // mantém o foco no campo de texto que será criado
      placeAt('text', page, p)
      return
    }
    if (tool === 'length' || tool === 'area' || tool === 'hole' || tool === 'space' || tool === 'solid') {
      if (e.detail >= 2) return // duplo clique finaliza (onDoubleClick)
      const q = p
      if (poly && poly.kind === tool) {
        // fechar polígono clicando no primeiro vértice
        if (tool !== 'length' && poly.points.length >= 3 && dist(q, poly.points[0]) < 8 / zoom) return finishPoly()
        setPoly({ ...poly, points: [...poly.points, q] })
      } else setPoly({ kind: tool, points: [q], hover: q })
      return
    }
    if (tool === 'count') {
      const cur = countId.current && st.markups.find((m) => m.id === countId.current)
      if (cur) st.updateMarkup(cur.id, { points: [...cur.points, p] })
      else countId.current = st.addMarkup('count', page, [p]).id
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!info) return
    const d = drag.current
    const p = toPage(e)
    const st = useStore.getState()
    if (!d && DRAWING.includes(tool)) {
      const q = resolve(p, e, poly?.points[poly.points.length - 1])
      if (poly) setPoly({ ...poly, hover: q })
    } else if (!d && snapHit) setSnapHit(null)
    if (!d || d.type === 'pan') return
    if (d.type === 'symbol') return setSymRect({ a: d.start, b: p })
    if (d.type === 'draw') {
      const q = resolve(p, e, ['arrow', 'line', 'calibrate'].includes(d.kind) ? d.start : undefined)
      setDraft(mkDraft(d.kind, [d.start, q]))
    } else if (d.type === 'move') {
      const dx = p.x - d.start.x, dy = p.y - d.start.y
      if (!d.moved) {
        if (Math.hypot(dx, dy) * zoom < 3) return
        st.checkpoint()
        d.moved = true
      }
      useStore.setState({
        markups: st.markups.map((m) =>
          d.orig[m.id] ? { ...m, points: d.orig[m.id].map((q) => ({ x: q.x + dx, y: q.y + dy })), ...(d.holes[m.id] ? { holes: d.holes[m.id]!.map((h) => h.map((q) => ({ x: q.x + dx, y: q.y + dy }))) } : {}) } : m,
        ),
      })
    } else if (d.type === 'handle') {
      if (!d.moved) {
        st.checkpoint()
        d.moved = true
      }
      const m = st.markups.find((x) => x.id === d.id)
      if (!m) return
      const pts = m.points.slice()
      const prev = pts[d.idx - 1]
      pts[d.idx] = resolve(p, e, prev, m.id)
      st.updateMarkup(d.id, { points: pts }, false)
    } else if (d.type === 'marquee') {
      setMarquee({ a: d.start, b: p })
    }
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.type === 'handle') setSnapHit(null)
    const st = useStore.getState()
    if (!d) return
    if (d.type === 'symbol' && symRect) {
      const r = bbox([symRect.a, symRect.b])
      setSymRect(null)
      if (r.w * zoom < 6 || r.h * zoom < 6) return st.notify(t('viewer.arraste_um_retangulo_em_volta'))
      void doSymbol(r)
      return
    }
    if (d.type === 'draw' && draft) {
      const [a, b] = draft.points
      const tiny = dist(a, b) * zoom < 4
      setDraft(null)
      if (tiny) return
      commitDraw(d.kind, page, a, b)
    }
    if (d.type === 'marquee' && marquee) {
      const r = bbox([marquee.a, marquee.b])
      setMarquee(null)
      if (r.w * zoom < 3 && r.h * zoom < 3) return
      const hits = markupsInRect(st.markups, page, r)
      st.set({ selected: Array.from(new Set([...st.selected, ...hits])) })
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (poly) {
      finishPoly()
      return
    }
    const h = (e.target as Element).closest('[data-handle]') as SVGElement | null
    if (h) {
      const m = s.markups.find((x) => x.id === h.dataset.mid)
      if (m?.kind === 'count' && m.points.length > 1) {
        s.updateMarkup(m.id, { points: m.points.filter((_, i) => i !== Number(h.dataset.handle)) })
        return s.notify(t('viewer.item_removido_da_contagem'))
      }
    }
    const id = ((e.target as Element).closest('[data-id]') as SVGElement | null)?.dataset.id
    const m = id && s.markups.find((x) => x.id === id)
    if (m && (m.kind === 'text' || m.kind === 'stamp')) s.set({ editingText: m.id })
  }

  // ---------- arrastar arquivo ----------
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = Array.from(e.dataTransfer.files).find((x) => x.name.toLowerCase().endsWith('.pdf'))
    if (f) window.dispatchEvent(new CustomEvent('traco:file', { detail: f }))
  }

  /** Ponto da folha sob a mira (centro da área visível). */
  const miraPoint = (): Pt | null => {
    const el = box.current, svg = svgRef.current
    if (!el || !svg) return null
    const b = el.getBoundingClientRect(), r = svg.getBoundingClientRect()
    return { x: (b.left + b.width / 2 - r.left) / zoom, y: (b.top + b.height / 2 - r.top) / zoom }
  }
  /** Recalcula o ponto da mira (com snap) e o traço elástico até ele. */
  const updateMira = () => {
    if (!mira) return
    const raw = miraPoint()
    if (!raw) return
    const last = tool === 'calibrate' ? calStart ?? undefined : poly?.points[poly.points.length - 1]
    const q = resolve(raw, { shiftKey: false, altKey: false }, last)
    miraPt.current = q
    if (poly && (!poly.hover || poly.hover.x !== q.x || poly.hover.y !== q.y)) setPoly({ ...poly, hover: q })
    if (tool === 'calibrate' && calStart) setDraft(mkDraft('calibrate', [calStart, q]))
  }
  const handleScroll = () => {
    onScroll()
    if (mira) updateMira()
  }
  useEffect(() => {
    if (!mira) return
    const id = requestAnimationFrame(updateMira)
    return () => cancelAnimationFrame(id)
  }, [mira, zoom, size, poly?.points.length, calStart, snapState]) // eslint-disable-line react-hooks/exhaustive-deps

  // botões da mira (Adicionar ponto, Desfazer, Concluir, Cancelar) vêm da barra do celular
  useEffect(() => {
    if (!mira) return
    const h = (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail
      const q = miraPt.current ?? miraPoint()
      if (cmd === 'add' && q) {
        if (tool === 'calibrate') {
          if (!calStart) return setCalStart(q)
          setCalStart(null)
          setDraft(null)
          return commitDraw('calibrate', page, calStart, q)
        }
        if (poly && poly.kind === tool) {
          if (tool !== 'length' && poly.points.length >= 3 && dist(q, poly.points[0]) < 12 / zoom) return finishPoly()
          setPoly({ ...poly, points: [...poly.points, q] })
        } else setPoly({ kind: tool as 'length' | 'area' | 'hole' | 'space' | 'solid', points: [q], hover: q })
      } else if (cmd === 'undo') {
        if (tool === 'calibrate') {
          setCalStart(null)
          setDraft(null)
        } else if (poly) setPoly(poly.points.length <= 1 ? null : { ...poly, points: poly.points.slice(0, -1) })
      } else if (cmd === 'done') finishPoly()
      else if (cmd === 'cancel') {
        setPoly(null)
        setCalStart(null)
        setDraft(null)
      }
    }
    window.addEventListener('traco:mira', h)
    return () => window.removeEventListener('traco:mira', h)
  }, [mira, tool, poly, calStart, zoom, page, finishPoly]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mira) return useMira.setState({ n: 0, min: 2 })
    useMira.setState(tool === 'calibrate' ? { n: calStart ? 1 : 0, min: 99 } : { n: poly?.points.length ?? 0, min: minVertices(tool as 'length' | 'area' | 'hole' | 'space' | 'solid') })
  }, [mira, tool, poly?.points.length, calStart])

  // celular: pinça (zoom na folha, não na página) e arrastar com dois dedos.
  // O ouvinte fica no document (captura) para agir antes dos tratadores do React e cancelar o gesto de um dedo que já tinha começado.
  useEffect(() => {
    const el = box.current
    if (!mobile || !el) return
    const pts = new Map<number, { x: number; y: number }>()
    let g: { d0: number; z0: number; px: number; py: number } | null = null
    const inside = (e: PointerEvent) => e.pointerType === 'touch' && el.contains(e.target as Node)
    const two = () => {
      const [a, b] = [...pts.values()]
      const r = el.getBoundingClientRect()
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top }
    }
    const down = (e: PointerEvent) => {
      if (!inside(e)) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size < 2) return
      // o primeiro dedo já podia ter começado um desenho, uma seleção ou o arrastar da mão
      drag.current = null
      el.classList.remove('panning')
      setDraft(null)
      setMarquee(null)
      setSymRect(null)
      const { d, cx, cy } = two()
      const z0 = useStore.getState().zoom
      const l = layoutFor(z0)
      g = { d0: d, z0, px: (el.scrollLeft + cx - l.left) / z0, py: (el.scrollTop + cy - l.top) / z0 }
      e.stopPropagation()
      e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (!g || pts.size < 2) return
      e.stopPropagation()
      e.preventDefault()
      const { d, cx, cy } = two()
      zoomAt(g.z0 * (d / g.d0), g.px, g.py, cx, cy)
    }
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      if (g) e.stopPropagation()
      pts.delete(e.pointerId)
      if (pts.size < 2) g = null
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointermove', move, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
    }
  }, [mobile, hasDoc, layoutFor, zoomAt])

  if (!doc || !info) {
    return <ViewerEmpty boxRef={box} dragOver={dragOver} setDragOver={setDragOver} onDrop={onDrop} onOpen={onOpen} onSample={() => openSample()} />
  }

  const pageMarkups = s.markups.filter((m) => m.page === page)
  const presetById = Object.fromEntries(s.presets.map((p) => [p.id, p]))
  const sheetScale = s.scales[page]
  const stampCtx = { n: s.page + 1, total: s.sheets.length, label: sheet?.label ?? '', file: s.fileName, author: s.author }
  const sel = s.selected.length === 1 ? pageMarkups.find((m) => m.id === s.selected[0]) : undefined
  const polyDraft = poly ? { ...mkDraft(poly.kind === 'hole' ? 'area' : poly.kind, poly.hover ? [...poly.points, poly.hover] : poly.points), ...(poly.kind === 'hole' ? { color: '#ff6369', fill: '#ff6369', fillOpacity: 0.15, presetId: null } : {}) } : null
  const editing = s.editingText ? s.markups.find((m) => m.id === s.editingText) : undefined
  const cursor = space.current || tool === 'pan' ? (drag.current?.type === 'pan' ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : tool === 'fill' ? 'cell' : 'crosshair'

  return (
    <div className="viewer-wrap">
      <div
        className={`viewer ${dragOver ? 'drag' : ''}`}
        ref={box}
        onScroll={handleScroll}
        onPointerDownCapture={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onMouseDown={(e) => e.button === 1 && e.preventDefault() /* evita o autoscroll do Windows */}
        onAuxClick={(e) => e.preventDefault()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="stage" style={{ width: L.sw, height: L.sh }}>
          <div className="sheet" style={{ left: L.left, top: L.top, width: L.pw, height: L.ph }}>
            <canvas ref={baseRef} style={{ width: L.pw, height: L.ph }} />
          </div>
          <canvas ref={detailRef} className="detail" />
          {overlays.length > 0 && <OverlayCanvas overlays={overlays} w={info.width} h={info.height} k={Math.min(baseScale.current || 1, 3)} left={L.left} top={L.top} cssW={L.pw} cssH={L.ph} />}
          <svg
            ref={svgRef}
            className="overlay"
            style={{ left: L.left, top: L.top, width: L.pw, height: L.ph, cursor }}
            viewBox={`0 0 ${info.width} ${info.height}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
            onContextMenu={(e) => {
              e.preventDefault()
              if (poly) finishPoly()
            }}
          >
            <PatternDefs presets={s.presets} />
            <rect width={info.width} height={info.height} fill="transparent" />
            {pageMarkups.map((m) =>
              m.kind === 'legend' ? (
                <LegendBox key={m.id} m={m} zoom={zoom} selected={s.selected.includes(m.id)} />
              ) : (
                <MarkupShape key={m.id} m={m} preset={m.presetId ? presetById[m.presetId] : undefined} scale={scaleFor(m, pageMarkups, sheetScale)} zoom={zoom} selected={s.selected.includes(m.id)} stampCtx={stampCtx} />
              ),
            )}
            <SearchHighlights hits={s.search.hits} page={page} index={s.search.index} zoom={zoom} />
            {symRect && <DashedRect a={symRect.a} b={symRect.b} zoom={zoom} color="#f76b15" fillOpacity={0.08} width={1.2} />}
            {symFound && <SymbolMatches found={symFound} zoom={zoom} />}
            {s.aligning && <AlignPoints pts={s.aligning.pts} overlay={overlays.find((o) => o.id === s.aligning!.overlay)} zoom={zoom} />}
            {draft && <MarkupShape m={draft} preset={draft.presetId ? presetById[draft.presetId] : undefined} scale={scaleFor(draft, pageMarkups, sheetScale)} zoom={zoom} selected={false} draft />}
            {polyDraft && <MarkupShape m={polyDraft} preset={polyDraft.presetId ? presetById[polyDraft.presetId] : undefined} scale={scaleFor(polyDraft, pageMarkups, sheetScale)} zoom={zoom} selected={false} draft />}
            {poly && poly.kind !== 'length' && poly.points.length >= 3 && (
              <circle cx={poly.points[0].x} cy={poly.points[0].y} r={6 / zoom} fill="none" stroke="var(--accent)" strokeWidth={1.5 / zoom} />
            )}
            {sel && tool === 'select' && sel.kind !== 'legend' && <SelectionHandles sel={sel} zoom={zoom} />}
            {snapHit && DRAWING.includes(tool) && <SnapMarker hit={snapHit} zoom={zoom} />}
            {marquee && <DashedRect a={marquee.a} b={marquee.b} zoom={zoom} color="var(--accent)" fillOpacity={0.08} />}
          </svg>
          {editing && editing.page === page && <TextEditor m={editing} zoom={zoom} left={L.left} top={L.top} />}
        </div>
      </div>
        {sheet && (s.tour === null || s.tour === 0) && found?.sheet === sheet.id && !found.hidden && <ScaleBanner sheetId={sheet.id} detected={found.n} current={s.scales[sheet.id]} onHide={() => setFound({ ...found, hidden: true })} />}
        <div className="view-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button className={s.snap ? 'on' : ''} onClick={() => { const v = !s.snap; s.set({ snap: v }); try { localStorage.setItem('traco.snap', JSON.stringify(v)) } catch { /* */ } }} data-tip={t('viewer.snap_na_geometria_do_pdf')}>
            <Magnet size={14} /> Snap{s.snap && snapState === 'loading' ? '…' : ''}
          </button>
          <button className={s.ortho ? 'on' : ''} onClick={() => s.set({ ortho: !s.ortho })} data-tip={t('viewer.ortogonal_so_0_e_90')}>
            <Move size={14} /> {t('viewer.orto')}</button>
        </div>
        {symFound && <SymbolResult found={symFound} sheetId={page} onClose={() => setSymFound(null)} />}
        {mira && <div className="mira" aria-hidden />}
        {!mira && <ViewerHints tool={tool} busy={busy} poly={poly} symFound={!!symFound} aligning={s.aligning} fillGap={s.fillGap} />}
    </div>
  )
}
