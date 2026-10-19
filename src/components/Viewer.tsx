import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { curSheet, useStore } from '../store'
import { detectScales, layerKey, ocConfig, viewportOf } from '../pdf'
import type { Markup, MarkupKind, Pt } from '../types'
import { MarkupShape, PatternDefs } from './MarkupShape'
import { bbox, dist, inPoly, inRect, polyArea, scaleFor, snapAngle } from '../geometry'
import { FileUp, Magnet, Move } from 'lucide-react'
import { fillAt, findSymbols } from '../geoWorker'
import { OverlayCanvas, applyM, invertM, overlaySheet, similarity } from './OverlayCanvas'
import { LegendBox } from './LegendBox'
import { SymbolResult } from './SymbolResult'
import { findSnap, snapIndexFor } from '../snap'
import { SnapMarker } from './SnapMarker'
import { ViewerHints } from './ViewerHints'
import { ScaleBanner } from './ScaleBanner'
import { TextEditor } from './TextEditor'
import { filterHoles, refineRing } from '../regions'
import type { SnapHit, SnapIndex } from '../snap'

const PAD = 48
const MAX_BASE_PIXELS = 14e6

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
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [proxy, setProxy] = useState<PDFPageProxy | null>(null)
  const baseScale = useRef(0)
  const tasks = useRef<{ base?: RenderTask; detail?: RenderTask }>({})
  const timers = useRef<{ base?: number; detail?: number }>({})
  const anchor = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)
  const drag = useRef<Drag | null>(null)
  const space = useRef(false)
  const countId = useRef<string | null>(null)
  const [draft, setDraft] = useState<Markup | null>(null)
  const [poly, setPoly] = useState<{ kind: 'length' | 'area' | 'hole' | 'space'; points: Pt[]; hover: Pt | null } | null>(null)
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
  const zoomAnim = useRef<{ target: number; px: number; py: number; cx: number; cy: number; raf: number } | null>(null)

  // ---------- layout ----------
  const layoutFor = useCallback(
    (z: number) => {
      const pw = (info?.width ?? 0) * z
      const ph = (info?.height ?? 0) * z
      const sw = Math.max(size.w, pw + PAD * 2)
      const sh = Math.max(size.h, ph + PAD * 2)
      return { pw, ph, sw, sh, left: (sw - pw) / 2, top: (sh - ph) / 2 }
    },
    [info, size],
  )
  const L = layoutFor(zoom)

  // o elemento da área de visualização muda ao abrir o primeiro documento: observa de novo
  const hasDoc = !!doc
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize((o) => (o.w === el.clientWidth && o.h === el.clientHeight ? o : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasDoc])

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

  // encaixar ao abrir documento / trocar de página
  useEffect(() => {
    if (info) useStore.setState({ fitReq: { mode: 'page', n: Date.now() } })
  }, [doc, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // "encaixar" roda só quando pedido (abrir, trocar folha, botões 0/W).
  // Antes reagia também a mudanças de tamanho — e as barras de rolagem do Windows,
  // ao aparecer com o zoom, mudavam o tamanho e desfaziam o zoom (piscadas).
  const lastFit = useRef(0)
  useEffect(() => {
    const f = s.fitReq
    const el = box.current
    if (!f || !info || !el || f.n === lastFit.current) return
    lastFit.current = f.n
    // offsetWidth inclui a área das barras de rolagem: medida estável
    const W = el.offsetWidth, Hh = el.offsetHeight
    const zw = (W - PAD * 2 - 16) / info.width
    const zh = (Hh - PAD * 2 - 16) / info.height
    const z = Math.max(0.05, f.mode === 'width' ? zw : Math.min(zw, zh))
    anchor.current = null
    useStore.setState({ zoom: z })
    requestAnimationFrame(() => {
      const b = box.current
      if (!b) return
      b.scrollLeft = (b.scrollWidth - b.clientWidth) / 2
      b.scrollTop = f.mode === 'width' ? 0 : (b.scrollHeight - b.clientHeight) / 2
    })
  }, [s.fitReq, info]) // eslint-disable-line react-hooks/exhaustive-deps

  // escala escrita no carimbo da folha (para o aviso "folha sem escala")
  useEffect(() => {
    if (!sheet || s.scales[sheet.id]) return
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
  const renderBase = useCallback(async () => {
    if (!proxy || !info) return
    tasks.current.base?.cancel()
    const dpr = window.devicePixelRatio || 1
    const want = zoom * dpr
    const cap = Math.sqrt(MAX_BASE_PIXELS / (info.width * info.height))
    const sc = Math.min(want, cap)
    if (Math.abs(sc - baseScale.current) / (sc || 1) < 0.08 && baseRef.current?.width && baseRef.current.dataset.lk === lk) return
    const vp = viewportOf(proxy, info, sc)
    const off = document.createElement('canvas')
    off.width = Math.floor(vp.width)
    off.height = Math.floor(vp.height)
    const oc = src ? await ocConfig(src) : null
    const task = proxy.render({ canvasContext: off.getContext('2d')!, viewport: vp, ...(oc ? { optionalContentConfigPromise: Promise.resolve(oc) } : {}) })
    tasks.current.base = task
    try {
      await task.promise
    } catch {
      return
    }
    const c = baseRef.current
    if (!c) return
    c.width = off.width
    c.height = off.height
    c.getContext('2d')!.drawImage(off, 0, 0)
    c.dataset.lk = lk
    baseScale.current = sc
    force((n) => n + 1)
  }, [proxy, info, zoom, lk]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderDetail = useCallback(async () => {
    const el = box.current
    const c = detailRef.current
    if (!proxy || !info || !el || !c) return
    const dpr = window.devicePixelRatio || 1
    const want = zoom * dpr
    if (baseScale.current >= want * 0.95) {
      c.style.display = 'none'
      return
    }
    const l = layoutFor(zoom)
    const x0 = Math.max(0, el.scrollLeft - l.left)
    const y0 = Math.max(0, el.scrollTop - l.top)
    const x1 = Math.min(l.pw, el.scrollLeft - l.left + el.clientWidth)
    const y1 = Math.min(l.ph, el.scrollTop - l.top + el.clientHeight)
    if (x1 <= x0 || y1 <= y0) return
    tasks.current.detail?.cancel()
    const vp = viewportOf(proxy, info, want)
    const off = document.createElement('canvas')
    off.width = Math.ceil((x1 - x0) * dpr)
    off.height = Math.ceil((y1 - y0) * dpr)
    const oc = src ? await ocConfig(src) : null
    const task = proxy.render({
      canvasContext: off.getContext('2d')!,
      viewport: vp,
      transform: [1, 0, 0, 1, -x0 * dpr, -y0 * dpr],
      ...(oc ? { optionalContentConfigPromise: Promise.resolve(oc) } : {}),
    })
    tasks.current.detail = task
    try {
      await task.promise
    } catch {
      return
    }
    c.width = off.width
    c.height = off.height
    c.getContext('2d')!.drawImage(off, 0, 0)
    Object.assign(c.style, { display: 'block', left: `${l.left + x0}px`, top: `${l.top + y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` })
  }, [proxy, info, zoom, layoutFor, lk]) // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (detailRef.current) detailRef.current.style.display = 'none'
    clearTimeout(timers.current.base)
    timers.current.base = window.setTimeout(async () => {
      await renderBase()
      renderDetail()
    }, 90)
  }, [renderBase, renderDetail])

  const onScroll = () => {
    clearTimeout(timers.current.detail)
    timers.current.detail = window.setTimeout(renderDetail, 110)
  }

  // ---------- zoom no cursor ----------
  // zoom suave: anima até o alvo mantendo fixo o ponto sob o cursor
  const layoutRef = useRef(layoutFor)
  layoutRef.current = layoutFor
  const smoothZoom = useCallback((factor: number, cx: number, cy: number) => {
    const el = box.current
    if (!el) return
    const cur = useStore.getState().zoom
    const a = zoomAnim.current
    const base = a ? a.target : cur
    const target = Math.min(40, Math.max(0.05, base * factor))
    const l = layoutRef.current(cur)
    const px = (el.scrollLeft + cx - l.left) / cur
    const py = (el.scrollTop + cy - l.top) / cur
    if (a) cancelAnimationFrame(a.raf)
    const anim = { target, px, py, cx, cy, raf: 0 }
    zoomAnim.current = anim
    const step = () => {
      const z = useStore.getState().zoom
      const lz = Math.log(z), lt = Math.log(anim.target)
      const done = Math.abs(lt - lz) < 0.004
      const nz = done ? anim.target : Math.exp(lz + (lt - lz) * 0.32)
      anchor.current = { px: anim.px, py: anim.py, cx: anim.cx, cy: anim.cy }
      useStore.setState({ zoom: nz })
      if (done) zoomAnim.current = null
      else anim.raf = requestAnimationFrame(step)
    }
    anim.raf = requestAnimationFrame(step)
  }, [])

  useLayoutEffect(() => {
    const el = box.current
    const a = anchor.current
    if (!el || !a) return
    const l = layoutFor(zoom)
    el.scrollLeft = a.px * zoom + l.left - a.cx
    el.scrollTop = a.py * zoom + l.top - a.cy
    anchor.current = null
  }, [zoom, layoutFor])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!useStore.getState().sheets.length) return
      if (e.shiftKey && !e.ctrlKey) return // rolagem horizontal nativa
      e.preventDefault()
      const r = el.getBoundingClientRect()
      // mouse: ~100 por "clique" da roda; touchpad: valores pequenos e contínuos
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      const f = Math.exp(-Math.max(-300, Math.min(300, dy)) * (e.ctrlKey ? 0.012 : 0.0016))
      smoothZoom(f, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [smoothZoom, hasDoc])

  // zoom pelos botões da barra (centro da tela)
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<number>).detail
      smoothZoom(f, size.w / 2, size.h / 2)
    }
    window.addEventListener('traco:zoom', h)
    return () => window.removeEventListener('traco:zoom', h)
  }, [smoothZoom, size])

  // centraliza um ponto da folha (busca, lista de itens)
  useEffect(() => {
    const h = (e: Event) => {
      const el = box.current
      if (!el) return
      const p = (e as CustomEvent<{ x: number; y: number }>).detail
      const l = layoutFor(zoom)
      el.scrollTo({ left: p.x * zoom + l.left - el.clientWidth / 2, top: p.y * zoom + l.top - el.clientHeight / 2, behavior: 'smooth' })
    }
    window.addEventListener('traco:center', h)
    return () => window.removeEventListener('traco:center', h)
  }, [zoom, layoutFor])

  // ---------- teclado (desenho em andamento) ----------
  const finishPoly = useCallback(() => {
    setPoly((pl) => {
      if (!pl) return null
      const st = useStore.getState()
      const need = pl.kind === 'length' ? 2 : 3
      if (pl.points.length < need) return null
      if (pl.kind === 'hole') addHole(pl.points)
      else if (pl.kind === 'space') {
        const n = st.markups.filter((m) => m.kind === 'space').length + 1
        const m = st.addMarkup('space', page, pl.points, { text: `Ambiente ${n}`, color: '#8e4ec6' })
        st.set({ selected: [m.id], rightTab: 'props', panels: { ...st.panels, right: true } })
      } else st.addMarkup(pl.kind, page, pl.points)
      return null
    })
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Acrescenta um vazio à área/ambiente que contém o polígono (ou à selecionada). */
  const addHole = (pts: Pt[]) => {
    const st = useStore.getState()
    const c = { x: pts.reduce((t, p) => t + p.x, 0) / pts.length, y: pts.reduce((t, p) => t + p.y, 0) / pts.length }
    const cands = st.markups.filter((m) => m.page === page && (m.kind === 'area' || m.kind === 'space') && inPoly(c, m.points))
    const target = cands.find((m) => m.id === st.holeTarget) ?? cands.find((m) => st.selected.includes(m.id)) ?? cands.sort((a, b) => polyArea(a.points) - polyArea(b.points))[0]
    if (!target) return st.notify('Desenhe o vazio dentro de uma área ou ambiente')
    st.updateMarkup(target.id, { holes: [...(target.holes ?? []), pts] })
    st.set({ selected: [target.id] })
    st.notify('Vazio descontado da área')
  }

  /** Área por clique: contorno fechado pelas linhas do PDF ao redor do ponto. */
  const doFill = async (p: Pt, asHole: boolean) => {
    const st = useStore.getState()
    if (!sheet || !snapIdx.current) return st.notify('Aguarde: lendo as linhas da folha…')
    setBusy('Detectando contorno…')
    try {
      const r = await fillAt(sheet, snapIdx.current, p, st.fillGap)
      if (!r.ok) return st.notify(r.reason ?? 'Não foi possível detectar o contorno')
      const refine = (ring: Pt[]) => refineRing(snapIdx.current, ring, r.halfLine ?? 1)
      const outer = refine(r.outer!)
      const holes = filterHoles(page, r.holes!.map(refine).filter((h) => h.length >= 3))
      if (outer.length < 3) return st.notify('Contorno muito pequeno')
      if (asHole) return addHole(outer)
      if (st.fillAs === 'space') {
        const n = st.markups.filter((m) => m.kind === 'space').length + 1
        const m = st.addMarkup('space', page, outer, { text: `Ambiente ${n}`, color: '#8e4ec6', holes })
        st.set({ selected: [m.id], rightTab: 'props', panels: { ...st.panels, right: true } })
      } else {
        const m = st.addMarkup('area', page, outer, holes.length ? { holes } : {})
        st.set({ selected: [m.id] })
        if (holes.length) st.notify(`Área criada com ${holes.length} vazio(s) descontado(s)`)
      }
    } finally {
      setBusy(null)
    }
  }

  /** Contagem automática: procura cópias do símbolo selecionado na folha. */
  const doSymbol = async (rect: { x: number; y: number; w: number; h: number }) => {
    const st = useStore.getState()
    if (!sheet || !snapIdx.current) return
    setBusy('Procurando símbolos iguais…')
    try {
      const r = await findSymbols(sheet, snapIdx.current, sheet, snapIdx.current, rect, true)
      if (!r.ok) {
        if (r.reason === 'vector-empty') {
          const { findSymbolsRasterOn } = await import('../symbolRaster')
          const centers = await findSymbolsRasterOn(sheet, rect)
          setSymFound({ rect, centers })
          return
        }
        return st.notify(r.reason ?? 'Nada encontrado')
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
    countId.current = null
  }, [tool, s.activePreset])

  // ---------- pan (botão do meio, Espaço ou ferramenta Mão) ----------
  const onPanDown = (e: React.PointerEvent) => {
    if (!(e.button === 1 || (e.button === 0 && (space.current || tool === 'pan')))) return
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
    if (drag.current?.type !== 'pan') return
    drag.current = null
    box.current?.releasePointerCapture(e.pointerId)
    box.current?.classList.remove('panning')
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
    if (st.snap && !e.altKey) {
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
  const DRAWING = ['length', 'area', 'count', 'calibrate', 'rect', 'ellipse', 'cloud', 'arrow', 'line', 'viewport', 'redact', 'hole', 'space', 'align']

  const mkDraft = (kind: MarkupKind | 'calibrate', pts: Pt[]): Markup => {
    const st = useStore.getState()
    const pr = st.presets.find((p) => p.id === st.activePreset && p.measure === kind)
    const color = kind === 'calibrate' ? '#0090ff' : pr?.color ?? '#e5484d'
    return {
      id: '__draft', page, kind: kind === 'calibrate' ? 'line' : kind, points: pts, text: '', comment: '', status: 'aberto',
      author: '', createdAt: 0, presetId: pr?.id ?? null, deduct: false, color, width: kind === 'calibrate' ? 1.5 / zoom : pr?.width ?? 1.5,
      fill: color, fillOpacity: pr?.opacity ?? (kind === 'area' ? 0.2 : 0), fontSize: 12,
    }
  }

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
    st.notify(`"${ov.label}" alinhada (escala ${(Math.hypot(m[0], m[1]) * 100).toFixed(1)}%)`)
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
      const m = st.addMarkup('legend', page, [raw, { x: raw.x + 260, y: raw.y + 120 }], { legend: { scope: 'sheet', prices: false }, color: '#1f2937', fontSize: 8 })
      st.set({ tool: 'select', selected: [m.id], rightTab: 'props', panels: { ...st.panels, right: true } })
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
      const m = st.addMarkup('stamp', page, [{ x: p.x - 90, y: p.y - 22 }, { x: p.x + 90, y: p.y + 22 }], { text: 'REVISADO\n{data}', color: '#e5484d', width: 2, fontSize: 14 })
      st.set({ editingText: m.id, tool: 'select' })
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
      const m = st.addMarkup('text', page, [p, { x: p.x + 160, y: p.y + 42 }], { color: '#e5484d', width: 1 })
      st.set({ editingText: m.id, tool: 'select' })
      return
    }
    if (tool === 'length' || tool === 'area' || tool === 'hole' || tool === 'space') {
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
      if (r.w * zoom < 6 || r.h * zoom < 6) return st.notify('Arraste um retângulo em volta de UM símbolo')
      void doSymbol(r)
      return
    }
    if (d.type === 'draw' && draft) {
      const [a, b] = draft.points
      const tiny = dist(a, b) * zoom < 4
      setDraft(null)
      if (tiny) return
      if (d.kind === 'calibrate') {
        // calibrar dentro de um viewport define a escala daquele viewport
        const vp = st.markups.find((v) => v.kind === 'viewport' && v.page === page && inRect(a, v.points[0], v.points[1]))
        st.set({ calibrating: { page, length: dist(a, b), viewport: vp?.id }, tool: 'select' })
      } else if (d.kind === 'viewport') {
        const n = st.markups.filter((v) => v.kind === 'viewport' && v.page === page).length + 1
        const m = st.addMarkup('viewport', page, [a, b], { text: `Viewport ${n}`, color: '#0090ff' })
        st.set({ calibrating: { page, length: 0, viewport: m.id }, tool: 'select' })
      } else if (d.kind === 'redact') {
        const m = st.addMarkup('redact', page, [a, b], { fill: st.redactFill, color: st.redactFill, fillOpacity: 1, fontSize: Math.max(6, Math.min(24, Math.round(dist(a, b) > 0 ? Math.abs(b.y - a.y) * 0.6 : 9))) })
        if (st.redactFill === '#ffffff') st.set({ rightTab: 'props', selected: [m.id], panels: { ...st.panels, right: true } }) // já abre o campo de texto de substituição
      }
      else {
        const m = st.addMarkup(d.kind, page, [a, b])
        // itens de revisão (nuvem, retângulo, seta…) já abrem as propriedades: responsável, prazo, respostas
        if (['cloud', 'rect', 'ellipse', 'arrow', 'line'].includes(d.kind)) st.set({ selected: [m.id], rightTab: 'props', panels: { ...st.panels, right: true } })
      }
    }
    if (d.type === 'marquee' && marquee) {
      const r = bbox([marquee.a, marquee.b])
      setMarquee(null)
      if (r.w * zoom < 3 && r.h * zoom < 3) return
      const hits = st.markups
        .filter((m) => m.page === page)
        .filter((m) => {
          const b = bbox(m.points)
          return b.x <= r.x + r.w && b.x + b.w >= r.x && b.y <= r.y + r.h && b.y + b.h >= r.y
        })
        .map((m) => m.id)
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
        return s.notify('Item removido da contagem')
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

  if (!doc || !info) {
    return (
      <div
        className={`viewer empty ${dragOver ? 'drag' : ''}`}
        ref={box}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="empty-card">
          <div className="empty-icon"><FileUp size={28} strokeWidth={1.6} /></div>
          <h2>Abra uma prancha para começar</h2>
          <p>Arraste um PDF aqui ou</p>
          <button className="btn primary" onClick={onOpen}>Abrir PDF</button>
          <div className="kbd-hint"><kbd>Ctrl</kbd>+<kbd>O</kbd></div>
        </div>
      </div>
    )
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
        onScroll={onScroll}
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
            {s.search.hits.map((h, i) =>
              h.sheet === page ? (
                <rect key={`sh${i}`} x={h.x - 1} y={h.y - 1} width={h.w + 2} height={h.h + 2} rx={1} fill="#ffd60a" fillOpacity={i === s.search.index ? 0.55 : 0.28} stroke={i === s.search.index ? '#ff9f0a' : 'none'} strokeWidth={1.5 / zoom} style={{ pointerEvents: 'none' }} />
              ) : null,
            )}
            {symRect && (() => {
              const r = bbox([symRect.a, symRect.b])
              return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#f76b15" fillOpacity={0.08} stroke="#f76b15" strokeWidth={1.2 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
            })()}
            {symFound && (
              <g style={{ pointerEvents: 'none' }}>
                {symFound.centers.map((c, i) => (
                  <rect key={i} x={c.x - symFound.rect.w / 2 - 2} y={c.y - symFound.rect.h / 2 - 2} width={symFound.rect.w + 4} height={symFound.rect.h + 4} rx={2} fill="#f76b15" fillOpacity={0.12} stroke="#f76b15" strokeWidth={1.4 / zoom} />
                ))}
              </g>
            )}
            {s.aligning && s.aligning.pts.map((q, i) => {
              const ov = overlays.find((o) => o.id === s.aligning!.overlay)
              const pt = i % 2 === 0 && ov ? applyM(ov.matrix, q) : q
              return <circle key={`al${i}`} cx={pt.x} cy={pt.y} r={5 / zoom} fill={i % 2 === 0 ? ov?.color ?? '#f00' : 'var(--accent)'} stroke="#fff" strokeWidth={1.5 / zoom} style={{ pointerEvents: 'none' }} />
            })}
            {draft && <MarkupShape m={draft} preset={draft.presetId ? presetById[draft.presetId] : undefined} scale={scaleFor(draft, pageMarkups, sheetScale)} zoom={zoom} selected={false} draft />}
            {polyDraft && <MarkupShape m={polyDraft} preset={polyDraft.presetId ? presetById[polyDraft.presetId] : undefined} scale={scaleFor(polyDraft, pageMarkups, sheetScale)} zoom={zoom} selected={false} draft />}
            {poly && poly.kind !== 'length' && poly.points.length >= 3 && (
              <circle cx={poly.points[0].x} cy={poly.points[0].y} r={6 / zoom} fill="none" stroke="var(--accent)" strokeWidth={1.5 / zoom} />
            )}
            {sel && tool === 'select' && sel.kind !== 'legend' &&
              sel.points.map((p, i) => (
                <rect
                  key={i}
                  data-handle={i}
                  data-mid={sel.id}
                  x={p.x - 4 / zoom}
                  y={p.y - 4 / zoom}
                  width={8 / zoom}
                  height={8 / zoom}
                  rx={1.5 / zoom}
                  fill="var(--handle-fill)"
                  stroke="var(--accent)"
                  strokeWidth={1.5 / zoom}
                  style={{ cursor: 'crosshair' }}
                />
              ))}
            {snapHit && DRAWING.includes(tool) && <SnapMarker hit={snapHit} zoom={zoom} />}
            {marquee && (() => {
              const r = bbox([marquee.a, marquee.b])
              return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--accent)" fillOpacity={0.08} stroke="var(--accent)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
            })()}
          </svg>
          {editing && editing.page === page && <TextEditor m={editing} zoom={zoom} left={L.left} top={L.top} />}
        </div>
      </div>
        {sheet && !s.scales[sheet.id] && found?.sheet === sheet.id && !found.hidden && <ScaleBanner sheetId={sheet.id} detected={found.n} onHide={() => setFound({ ...found, hidden: true })} />}
        <div className="view-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button className={s.snap ? 'on' : ''} onClick={() => { const v = !s.snap; s.set({ snap: v }); try { localStorage.setItem('traco.snap', JSON.stringify(v)) } catch { /* */ } }} data-tip="Snap na geometria do PDF  F3 (Alt desliga ao segurar)">
            <Magnet size={14} /> Snap{s.snap && snapState === 'loading' ? '…' : ''}
          </button>
          <button className={s.ortho ? 'on' : ''} onClick={() => s.set({ ortho: !s.ortho })} data-tip="Ortogonal: só 0° e 90°  F8 (Shift = 45°)">
            <Move size={14} /> Orto
          </button>
        </div>
        {symFound && <SymbolResult found={symFound} sheetId={page} onClose={() => setSymFound(null)} />}
        <ViewerHints tool={tool} busy={busy} poly={poly} symFound={!!symFound} aligning={s.aligning} fillGap={s.fillGap} />
    </div>
  )
}
