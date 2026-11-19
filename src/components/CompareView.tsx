import { useEffect, useRef, useState } from 'react'
import { Cloud, FileUp, Minus, Plus } from 'lucide-react'
import { uid, useStore } from '../store'
import { renderSheet } from '../pdf'
import { t, tp } from '../i18n'
import { TabPill } from './TabPill'
import { useIsMobile } from '../mobile'
import { Glyph } from './Icon'
import { clearCompare, compareSelection, compareZoomBy, pickOtherPdf, publishCompare, regionsLabel, resetCompareUi, setCompareA, setCompareB, setCompareView, useCompareUi } from '../compareShare'
import type { CompareView as View, CompareOption } from '../compareShare'

interface Region { x: number; y: number; w: number; h: number; px: number }

const RES = 2200 // largura de renderização para comparação (px)

function darkness(d: Uint8ClampedArray, i: number) {
  return 1 - (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255
}

/** Detecta regiões alteradas: grade de células + agrupamento de vizinhas. */
function findRegions(A: ImageData, B: ImageData, cell = 14, minPx = 6): Region[] {
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height)
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell)
  const grid = new Uint16Array(gw * gh)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ia = (y * A.width + x) * 4, ib = (y * B.width + x) * 4
      if (Math.abs(darkness(A.data, ia) - darkness(B.data, ib)) > 0.35) grid[Math.floor(y / cell) * gw + Math.floor(x / cell)]++
    }
  const seen = new Uint8Array(gw * gh)
  const out: Region[] = []
  for (let i = 0; i < grid.length; i++) {
    if (seen[i] || grid[i] < minPx) continue
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, px = 0
    const stack = [i]
    seen[i] = 1
    while (stack.length) {
      const k = stack.pop()!
      const cx = k % gw, cy = (k / gw) | 0
      px += grid[k]
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy)
      // vizinhança de 2 células para unir traços próximos
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
          const n = ny * gw + nx
          if (!seen[n] && grid[n] >= minPx) { seen[n] = 1; stack.push(n) }
        }
    }
    if (px > minPx * 3) out.push({ x: x0 * cell, y: y0 * cell, w: (x1 - x0 + 1) * cell, h: (y1 - y0 + 1) * cell, px })
  }
  return out.sort((a, b) => b.px - a.px)
}


/** Barra do celular (sem faixa de opções): revisões A e B, carregar PDF, modo, aviso e Nuvens em B. No PC isso fica na faixa. */
function MobileSide({ options, aId, bId, view, mismatch, busy, regions, bIsLocal, toClouds }: {
  options: CompareOption[]; aId: string; bId: string; view: View; mismatch: boolean; busy: boolean; regions: number; bIsLocal: boolean; toClouds: () => void
}) {
  const Select = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label={t('compareview.conjunto_atual')}>{options.filter((o) => !o.ext).map((o, i) => <option key={o.sh.id} value={o.sh.id}>{i + 1}. {o.sh.label}</option>)}</optgroup>
      {options.some((o) => o.ext) && <optgroup label={t('compareview.outro_pdf')}>{options.filter((o) => o.ext).map((o) => <option key={o.sh.id} value={o.sh.id}>{o.sh.label}</option>)}</optgroup>}
    </select>
  )
  return (
    <aside className="panel compare-side">
      <div className="pad stack">
        <label className="field"><span><i className="sw red" /> {t('compareview.revisao_antiga_a')}</span><Select value={aId} onChange={setCompareA} /></label>
        <label className="field"><span><i className="sw blue" /> {t('compareview.revisao_nova_b')}</span><Select value={bId} onChange={setCompareB} /></label>
        <button className="btn sm" onClick={pickOtherPdf}><FileUp size={14} /> {t('compareview.carregar_outro_pdf')}</button>
        <div className="seg wide"><TabPill />
          <button className={view === 'overlay' ? 'active' : ''} onClick={() => setCompareView('overlay')}>{t('compareview.sobrepor')}</button>
          <button className={view === 'diff' ? 'active' : ''} onClick={() => setCompareView('diff')}>{t('compareview.so_diferencas')}</button>
          <button className={view === 'side' ? 'active' : ''} onClick={() => setCompareView('side')}>{t('compareview.lado_a_lado')}</button>
        </div>
        {mismatch && <span className="warn">{t('compareview.as_folhas_tem_tamanhos_diferentes')}</span>}
      </div>
      <div className="region-head">
        <span>{busy ? t('compareview.analisando') : regionsLabel(regions)}</span>
        <button className="btn sm primary" disabled={!regions || !bIsLocal} onClick={toClouds} title={bIsLocal ? '' : t('compareview.a_revisao_nova_precisa_estar')}><Cloud size={14} /> {t('compareview.nuvens_em_b')}</button>
      </div>
    </aside>
  )
}

/** Cabeçalho de um painel do lado a lado: letra da revisão com a cor dela, nome e a folha. */
function PaneHead({ letter, title, sheet, file }: { letter: 'A' | 'B'; title: string; sheet: string; file: string }) {
  return (
    <div className="rx pnh">
      <span className="tag"><i className={`sw cz ${letter === 'A' ? 'red' : 'blue'}`} />{letter}</span>
      <b>{title}</b>
      <span>{sheet} · {file}</span>
    </div>
  )
}

export function CompareView() {
  const s = useStore()
  const ui = useCompareUi()
  const mobile = useIsMobile()
  const { view, zoom } = ui
  const cs = compareSelection(s.sheets, ui)
  const [regions, setRegions] = useState<Region[]>([])
  const [busy, setBusy] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0, scale: 1, mismatch: false })
  const canvas = useRef<HTMLCanvasElement>(null)
  const sideA = useRef<HTMLCanvasElement>(null)
  const sideB = useRef<HTMLCanvasElement>(null)
  const scrollMain = useRef<HTMLDivElement>(null)
  const scrollA = useRef<HTMLDivElement>(null)
  const scrollB = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)
  const data = useRef<{ A?: ImageData; B?: ImageData }>({})
  const A = cs.a?.sh
  const B = cs.b?.sh
  const bIsLocal = !!cs.b && !cs.b.ext

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!A || !B) return
      setBusy(true)
      const scale = RES / Math.max(A.width, A.height)
      const ca = await renderSheet(s.sources[A.src], A, scale)
      const cb = await renderSheet(s.sources[B.src], B, scale)
      if (!alive) return
      const w = Math.min(ca.width, cb.width), h = Math.min(ca.height, cb.height)
      const ia = ca.getContext('2d')!.getImageData(0, 0, ca.width, ca.height)
      const ib = cb.getContext('2d')!.getImageData(0, 0, cb.width, cb.height)
      data.current = { A: ia, B: ib }
      setDims({ w, h, scale, mismatch: Math.abs(A.width - B.width) > 2 || Math.abs(A.height - B.height) > 2 })
      setRegions(findRegions(ia, ib))
      setBusy(false)
    })()
    return () => {
      alive = false
    }
  }, [A, B]) // eslint-disable-line react-hooks/exhaustive-deps

  // pinta a visualização
  useEffect(() => {
    const { A: ia, B: ib } = data.current
    if (!ia || !ib || !dims.w) return
    if (view === 'side') {
      for (const [c, img] of [[sideA.current, ia], [sideB.current, ib]] as const) {
        if (!c) continue
        c.width = img.width
        c.height = img.height
        c.getContext('2d')!.putImageData(img, 0, 0)
      }
      return
    }
    const c = canvas.current
    if (!c) return
    c.width = dims.w
    c.height = dims.h
    const ctx = c.getContext('2d')!
    const out = ctx.createImageData(dims.w, dims.h)
    for (let y = 0; y < dims.h; y++)
      for (let x = 0; x < dims.w; x++) {
        const a = darkness(ia.data, (y * ia.width + x) * 4), b = darkness(ib.data, (y * ib.width + x) * 4)
        const o = (y * dims.w + x) * 4
        if (view === 'diff' && Math.abs(a - b) < 0.35) {
          const g = 255 - Math.max(a, b) * 40
          out.data[o] = out.data[o + 1] = out.data[o + 2] = g
        } else {
          // só na antiga = vermelho (removido) · só na nova = azul (acrescentado) · em ambas = preto
          out.data[o] = 255 * (1 - b)
          out.data[o + 1] = 255 * (1 - a) * (1 - b) + 60 * a * (1 - b)
          out.data[o + 2] = 255 * (1 - a)
        }
        out.data[o + 3] = 255
      }
    ctx.putImageData(out, 0, 0)
  }, [view, dims])

  const toClouds = () => {
    if (!B || !bIsLocal) return
    const k = 1 / dims.scale
    const pad = 6
    const ms = regions.map((r) => ({ a: { x: r.x * k - pad, y: r.y * k - pad }, b: { x: (r.x + r.w) * k + pad, y: (r.y + r.h) * k + pad } }))
    s.checkpoint()
    const now = Date.now()
    useStore.setState({
      markups: [
        ...useStore.getState().markups,
        ...ms.map((m, i) => ({
          id: uid(), page: B.id, kind: 'cloud' as const, points: [m.a, m.b], text: '', comment: t('compareview.alteracao_detectada', { n: i + 1, label: A?.label }),
          status: s.statuses[0]?.name ?? 'aberto', author: s.author, createdAt: now, presetId: null, deduct: false, color: '#e5484d', width: 1.5, fill: '#e5484d', fillOpacity: 0, fontSize: 12,
        })),
      ],
    })
    useStore.setState({ mode: 'review', page: s.sheets.findIndex((x) => x.id === B.id), tool: 'select', selected: [] })
    s.notify(tp('compareview.nuvens_criadas', ms.length, { label: B.label }))
  }

  /** Leva a vista até o centro da região, em cada painel de rolagem (um só, ou os dois no lado a lado). */
  const goTo = (r: Region) => {
    const pairs: [HTMLDivElement | null, HTMLCanvasElement | null][] = view === 'side' ? [[scrollA.current, sideA.current], [scrollB.current, sideB.current]] : [[scrollMain.current, canvas.current]]
    for (const [el, c] of pairs) {
      if (!el || !c) continue
      const er = el.getBoundingClientRect(), cr = c.getBoundingClientRect()
      el.scrollTo({
        left: el.scrollLeft + (cr.left - er.left) + (r.x + r.w / 2) * zoom - el.clientWidth / 2,
        top: el.scrollTop + (cr.top - er.top) + (r.y + r.h / 2) * zoom - el.clientHeight / 2,
        behavior: 'smooth',
      })
    }
  }

  // a paleta "Regiões alteradas", a faixa (Nuvens em B) e a barra de status leem o resultado daqui; chamam sempre a versão mais nova das funções
  const latest = useRef<{ toClouds: () => void; goTo: (i: number) => void }>({ toClouds, goTo: () => {} })
  latest.current = { toClouds, goTo: (i) => regions[i] && goTo(regions[i]) }
  useEffect(() => {
    publishCompare({
      regions: regions.map((r) => ({ w: Math.round(r.w / dims.scale), h: Math.round(r.h / dims.scale), px: r.px })),
      scale: dims.scale, busy, mismatch: dims.mismatch, bLocal: bIsLocal,
      goTo: (i) => latest.current.goTo(i), toClouds: () => latest.current.toClouds(),
    })
  }, [regions, dims.scale, dims.mismatch, busy, bIsLocal])
  useEffect(() => () => { clearCompare(); resetCompareUi() }, [])

  if (!s.sheets.length) return <div className="pages-view empty rx"><p className="vz">{t('compareview.abra_um_pdf_para_comparar')}</p></div>

  const sync = (from: HTMLDivElement, to: HTMLDivElement | null) => {
    if (!to || syncing.current) return
    syncing.current = true
    to.scrollLeft = from.scrollLeft
    to.scrollTop = from.scrollTop
    requestAnimationFrame(() => { syncing.current = false })
  }
  const fileOf = (o: CompareOption | undefined) => (o && !o.ext ? s.fileName : t('compareview.outro_pdf'))
  const sheetW = dims.w * zoom, sheetH = dims.h * zoom

  return (
    <div className="compare">
      {mobile && <MobileSide options={cs.options} aId={cs.aId} bId={cs.bId} view={view} mismatch={dims.mismatch} busy={busy} regions={regions.length} bIsLocal={bIsLocal} toClouds={toClouds} />}
      {!mobile && dims.mismatch && (
        <div className="rx al-host">
          <div className="al" role="alert"><Glyph name="alerta" size={12} /><span><b>{t('compareview.as_folhas_tem_tamanhos_diferentes')}</b></span></div>
        </div>
      )}
      <div className="compare-stage">
        {mobile && (
          <div className="compare-zoom">
            <button className="icon-btn" onClick={() => compareZoomBy(1 / 1.25)}><Minus size={16} /></button>
            <span className="zoom-val">{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" onClick={() => compareZoomBy(1.25)}><Plus size={16} /></button>
          </div>
        )}
        {view === 'side' ? (
          <div className="rx cmp-side">
            <div className="cmp-pane" aria-label={t('compareview.revisao_antiga_a')}>
              <PaneHead letter="A" title={t('compareview.revisao_antiga_a')} sheet={A?.label ?? ''} file={fileOf(cs.a)} />
              <div className="cmp-scroll" ref={scrollA} onScroll={(e) => sync(e.currentTarget, scrollB.current)}>
                <div className="cmp-mesa"><div className="cmp-sheet" style={{ width: sheetW, height: sheetH }}><canvas ref={sideA} style={{ width: sheetW, height: sheetH }} /></div></div>
              </div>
            </div>
            <i className="dvs" />
            <div className="cmp-pane" aria-label={t('compareview.revisao_nova_b')}>
              <PaneHead letter="B" title={t('compareview.revisao_nova_b')} sheet={B?.label ?? ''} file={fileOf(cs.b)} />
              <div className="cmp-scroll" ref={scrollB} onScroll={(e) => sync(e.currentTarget, scrollA.current)}>
                <div className="cmp-mesa"><div className="cmp-sheet" style={{ width: sheetW, height: sheetH }}><canvas ref={sideB} style={{ width: sheetW, height: sheetH }} /></div></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rx cmp-scroll" ref={scrollMain}>
            <div className="cmp-mesa">
              <div className="cmp-sheet" style={{ width: sheetW, height: sheetH }}>
                <canvas ref={canvas} style={{ width: sheetW, height: sheetH }} />
                {regions.map((r, i) => (
                  <div key={i} className="region-box" style={{ left: r.x * zoom, top: r.y * zoom, width: r.w * zoom, height: r.h * zoom }}><span>{i + 1}</span></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
