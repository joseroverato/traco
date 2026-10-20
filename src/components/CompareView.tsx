import { useEffect, useMemo, useRef, useState } from 'react'
import { Cloud, FileUp, Minus, Plus } from 'lucide-react'
import { uid, useStore } from '../store'
import { addSourceOnly } from '../project'
import { renderSheet } from '../pdf'
import type { Sheet } from '../types'
import { t } from '../i18n'

interface Region { x: number; y: number; w: number; h: number; px: number }
type View = 'overlay' | 'side' | 'diff'

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

export function CompareView() {
  const s = useStore()
  const [extra, setExtra] = useState<Sheet[]>([])
  const options = useMemo(() => [...s.sheets.map((x) => ({ sh: x, ext: false })), ...extra.map((x) => ({ sh: x, ext: true }))], [s.sheets, extra])
  const [aId, setA] = useState<string>(s.sheets[0]?.id ?? '')
  const [bId, setB] = useState<string>(s.sheets[1]?.id ?? s.sheets[0]?.id ?? '')
  const [view, setView] = useState<View>('overlay')
  const [zoom, setZoom] = useState(0.5)
  const [regions, setRegions] = useState<Region[]>([])
  const [busy, setBusy] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0, scale: 1, mismatch: false })
  const canvas = useRef<HTMLCanvasElement>(null)
  const side = useRef<HTMLCanvasElement>(null)
  const data = useRef<{ A?: ImageData; B?: ImageData }>({})
  const input = useRef<HTMLInputElement>(null)
  const A = options.find((o) => o.sh.id === aId)?.sh
  const B = options.find((o) => o.sh.id === bId)?.sh
  const bIsLocal = !!B && s.sheets.some((x) => x.id === B.id)

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
      const c = side.current!
      c.width = ia.width + ib.width + 24
      c.height = Math.max(ia.height, ib.height)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#888'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.putImageData(ia, 0, 0)
      ctx.putImageData(ib, ia.width + 24, 0)
      return
    }
    const c = canvas.current!
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
    s.notify(t('compareview.nuvens_criadas_em', { length: ms.length, label: B.label }))
  }

  const onFile = async (f: File) => {
    const { sheets } = await addSourceOnly(f)
    const named = sheets.map((x) => ({ ...x, label: `${f.name.replace(/\.pdf$/i, '')} · ${x.label}` }))
    setExtra([...extra, ...named])
    setA(named[0].id)
    s.notify(t('compareview.carregado_para_comparacao', { name: f.name }))
  }

  const goTo = (r: Region) => {
    const el = canvas.current?.parentElement?.parentElement
    if (!el) return
    el.scrollTo({ left: (r.x + r.w / 2) * zoom - el.clientWidth / 2, top: (r.y + r.h / 2) * zoom - el.clientHeight / 2, behavior: 'smooth' })
  }

  if (!s.sheets.length) return <div className="pages-view empty"><p className="muted">{t('compareview.abra_um_pdf_para_comparar')}</p></div>

  const Select = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label={t('compareview.conjunto_atual')}>{options.filter((o) => !o.ext).map((o, i) => <option key={o.sh.id} value={o.sh.id}>{i + 1}. {o.sh.label}</option>)}</optgroup>
      {extra.length > 0 && <optgroup label={t('compareview.outro_pdf')}>{options.filter((o) => o.ext).map((o) => <option key={o.sh.id} value={o.sh.id}>{o.sh.label}</option>)}</optgroup>}
    </select>
  )

  return (
    <div className="compare">
      <aside className="panel compare-side">
        <div className="pad stack">
          <label className="field"><span><i className="sw red" /> {t('compareview.revisao_antiga_a')}</span><Select value={aId} onChange={setA} /></label>
          <label className="field"><span><i className="sw blue" /> {t('compareview.revisao_nova_b')}</span><Select value={bId} onChange={setB} /></label>
          <button className="btn sm" onClick={() => input.current?.click()}><FileUp size={14} /> {t('compareview.carregar_outro_pdf')}</button>
          <div className="seg wide">
            <button className={view === 'overlay' ? 'active' : ''} onClick={() => setView('overlay')}>{t('compareview.sobrepor')}</button>
            <button className={view === 'diff' ? 'active' : ''} onClick={() => setView('diff')}>{t('compareview.so_diferencas')}</button>
            <button className={view === 'side' ? 'active' : ''} onClick={() => setView('side')}>{t('compareview.lado_a_lado')}</button>
          </div>
          <div className="legend small">
            <span><i className="sw red" /> {t('compareview.so_na_antiga_removido')}</span>
            <span><i className="sw blue" /> {t('compareview.so_na_nova_acrescentado')}</span>
            <span><i className="sw black" /> {t('compareview.igual_nas_duas')}</span>
          </div>
          {dims.mismatch && <span className="warn">{t('compareview.as_folhas_tem_tamanhos_diferentes')}</span>}
        </div>
        <div className="region-head">
          <span>{busy ? t('compareview.analisando') : t('compareview.regiao_oes_alterada_s', { length: regions.length })}</span>
          <button className="btn sm primary" disabled={!regions.length || !bIsLocal} onClick={toClouds} title={bIsLocal ? '' : t('compareview.a_revisao_nova_precisa_estar')}><Cloud size={14} /> {t('compareview.nuvens_em_b')}</button>
        </div>
        <div className="regions">
          {regions.map((r, i) => (
            <button key={i} className="region" onClick={() => goTo(r)}>
              <span className="badge">{i + 1}</span>
              <span>{Math.round(r.w / dims.scale)}×{Math.round(r.h / dims.scale)} pt</span>
              <span className="muted small">{r.px} px</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="compare-stage">
        <div className="compare-zoom">
          <button className="icon-btn" onClick={() => setZoom(Math.max(0.1, zoom / 1.25))}><Minus size={16} /></button>
          <span className="zoom-val">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom(Math.min(4, zoom * 1.25))}><Plus size={16} /></button>
        </div>
        <div className="compare-scroll">
          <div className="compare-canvas" style={{ width: (view === 'side' ? dims.w * 2 + 24 : dims.w) * zoom, height: dims.h * zoom }}>
            <canvas ref={canvas} style={{ display: view === 'side' ? 'none' : 'block', width: dims.w * zoom, height: dims.h * zoom }} />
            <canvas ref={side} style={{ display: view === 'side' ? 'block' : 'none', width: (dims.w * 2 + 24) * zoom, height: dims.h * zoom }} />
            {view !== 'side' && regions.map((r, i) => (
              <div key={i} className="region-box" style={{ left: r.x * zoom, top: r.y * zoom, width: r.w * zoom, height: r.h * zoom }}><span>{i + 1}</span></div>
            ))}
          </div>
        </div>
      </div>
      <input ref={input} type="file" accept=".pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}
