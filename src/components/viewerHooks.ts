/**
 * Hooks do visualizador: medida da área, zoom/rolagem e renderização do PDF em duas camadas
 * (base em resolução limitada + detalhe só da parte visível). O Viewer.tsx só os liga.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { useStore } from '../store'
import { ocConfig, viewportOf } from '../pdf'
import type { Source } from '../pdf'
import type { Sheet } from '../types'
import { clampZoom, fitZoom, wheelFactor, zoomStep } from '../viewerLogic'
import type { Layout } from '../viewerLogic'

const MAX_BASE_PIXELS = 14e6

/** Tamanho da área de visualização. Observa de novo quando o elemento muda (ao abrir o primeiro documento). */
export function useElementSize(box: RefObject<HTMLDivElement | null>, active: boolean) {
  const [size, setSize] = useState({ w: 800, h: 600 })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize((o) => (o.w === el.clientWidth && o.h === el.clientHeight ? o : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  return size
}

interface ZoomArgs {
  box: RefObject<HTMLDivElement | null>
  hasDoc: boolean
  info: Sheet | undefined
  doc: unknown
  page: string
  size: { w: number; h: number }
  zoom: number
  layoutFor: (z: number) => Layout
}

/** Encaixar (folha/largura), zoom suave no cursor (roda e botões) e centralizar um ponto. */
export function useZoomControls({ box, hasDoc, info, doc, page, size, zoom, layoutFor }: ZoomArgs) {
  const fitReq = useStore((s) => s.fitReq)
  const anchor = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)
  const zoomAnim = useRef<{ target: number; px: number; py: number; cx: number; cy: number; raf: number } | null>(null)

  // encaixar ao abrir documento / trocar de página
  useEffect(() => {
    if (info) useStore.setState({ fitReq: { mode: 'page', n: Date.now() } })
  }, [doc, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // "encaixar" roda só quando pedido (abrir, trocar folha, botões 0/W).
  // Antes reagia também a mudanças de tamanho — e as barras de rolagem do Windows,
  // ao aparecer com o zoom, mudavam o tamanho e desfaziam o zoom (piscadas).
  const lastFit = useRef(0)
  useEffect(() => {
    const f = fitReq
    const el = box.current
    if (!f || !info || !el || f.n === lastFit.current) return
    lastFit.current = f.n
    // offsetWidth inclui a área das barras de rolagem: medida estável
    const z = fitZoom(f.mode, { w: el.offsetWidth, h: el.offsetHeight }, info)
    anchor.current = null
    useStore.setState({ zoom: z })
    requestAnimationFrame(() => {
      const b = box.current
      if (!b) return
      b.scrollLeft = (b.scrollWidth - b.clientWidth) / 2
      b.scrollTop = f.mode === 'width' ? 0 : (b.scrollHeight - b.clientHeight) / 2
    })
  }, [fitReq, info]) // eslint-disable-line react-hooks/exhaustive-deps

  // zoom suave: anima até o alvo mantendo fixo o ponto sob o cursor
  const layoutRef = useRef(layoutFor)
  layoutRef.current = layoutFor
  const smoothZoom = useCallback((factor: number, cx: number, cy: number) => {
    const el = box.current
    if (!el) return
    const cur = useStore.getState().zoom
    const a = zoomAnim.current
    const base = a ? a.target : cur
    const target = clampZoom(base * factor)
    const l = layoutRef.current(cur)
    const px = (el.scrollLeft + cx - l.left) / cur
    const py = (el.scrollTop + cy - l.top) / cur
    if (a) cancelAnimationFrame(a.raf)
    const anim = { target, px, py, cx, cy, raf: 0 }
    zoomAnim.current = anim
    const step = () => {
      const { zoom: nz, done } = zoomStep(useStore.getState().zoom, anim.target)
      anchor.current = { px: anim.px, py: anim.py, cx: anim.cx, cy: anim.cy }
      useStore.setState({ zoom: nz })
      if (done) zoomAnim.current = null
      else anim.raf = requestAnimationFrame(step)
    }
    anim.raf = requestAnimationFrame(step)
  }, [box])

  // reposiciona a rolagem para o ponto sob o cursor continuar no mesmo lugar
  useLayoutEffect(() => {
    const el = box.current
    const a = anchor.current
    if (!el || !a) return
    const l = layoutFor(zoom)
    el.scrollLeft = a.px * zoom + l.left - a.cx
    el.scrollTop = a.py * zoom + l.top - a.cy
    anchor.current = null
  }, [zoom, layoutFor, box])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!useStore.getState().sheets.length) return
      if (e.shiftKey && !e.ctrlKey) return // rolagem horizontal nativa
      e.preventDefault()
      const r = el.getBoundingClientRect()
      smoothZoom(wheelFactor(e.deltaY, e.deltaMode, e.ctrlKey), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [smoothZoom, hasDoc, box])

  // zoom pelos botões da barra (centro da tela)
  useEffect(() => {
    const h = (e: Event) => smoothZoom((e as CustomEvent<number>).detail, size.w / 2, size.h / 2)
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
  }, [zoom, layoutFor, box])
}

interface RenderArgs {
  box: RefObject<HTMLDivElement | null>
  baseRef: RefObject<HTMLCanvasElement | null>
  detailRef: RefObject<HTMLCanvasElement | null>
  proxy: PDFPageProxy | null
  info: Sheet | undefined
  src: Source | undefined
  lk: string // chave das camadas visíveis: muda → redesenha
  zoom: number
  layoutFor: (z: number) => Layout
}

/**
 * Desenha a folha em duas camadas: a base (resolução limitada, refeita só quando o zoom muda bastante)
 * e o detalhe (só a região visível, em resolução total). Devolve a escala da base e o tratador de rolagem.
 */
export function usePageRender({ box, baseRef, detailRef, proxy, info, src, lk, zoom, layoutFor }: RenderArgs) {
  const baseScale = useRef(0)
  const tasks = useRef<{ base?: RenderTask; detail?: RenderTask }>({})
  const timers = useRef<{ base?: number; detail?: number }>({})
  const [, force] = useState(0)

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
    if (detailRef.current) detailRef.current.style.display = 'none'
    clearTimeout(timers.current.base)
    timers.current.base = window.setTimeout(async () => {
      await renderBase()
      renderDetail()
    }, 90)
  }, [renderBase, renderDetail]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    clearTimeout(timers.current.detail)
    timers.current.detail = window.setTimeout(renderDetail, 110)
  }

  return { baseScale, onScroll }
}
