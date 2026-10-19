import { useEffect, useState } from 'react'
import { Ruler, ScanSearch } from 'lucide-react'
import { useStore } from '../store'
import { fmt, paperScale } from '../geometry'
import { detectScales } from '../pdf'
import type { PageScale } from '../types'

const RATIOS = [20, 25, 50, 75, 100, 125, 200, 250, 500, 1000]

export function ScaleDialog() {
  const s = useStore()
  const c = s.calibrating
  const [val, setVal] = useState('')
  const [unit, setUnit] = useState<'m' | 'cm' | 'mm'>('m')
  const [ratio, setRatio] = useState('100')
  const [all, setAll] = useState(false)
  const [found, setFound] = useState<number[]>([])
  const sheet = c ? s.sheets.find((x) => x.id === c.page) : undefined

  useEffect(() => {
    if (!sheet || (c && c.length > 0)) return
    let alive = true
    detectScales(s.sources[sheet.src], sheet.srcIndex).then((f) => {
      if (!alive) return
      setFound(f)
      if (f[0]) setRatio(String(f[0]))
    })
    return () => {
      alive = false
    }
  }, [sheet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return null
  const vp = c.viewport ? s.markups.find((m) => m.id === c.viewport) : undefined
  const close = () => s.set({ calibrating: null, resumeTool: null })

  const apply = (sc: PageScale) => {
    const resume = s.resumeTool
    if (vp) {
      s.updateMarkup(vp.id, { scale: sc })
      s.set({ calibrating: null, resumeTool: null, ...(resume ? { tool: resume } : {}) })
      s.notify(`Escala ${sc.label} aplicada ao ${vp.text || 'viewport'}`)
      return
    }
    const scales = { ...s.scales }
    if (all) s.sheets.forEach((sh) => (scales[sh.id] = sc))
    else scales[c.page] = sc
    s.set({ scales, calibrating: null, resumeTool: null, ...(resume ? { tool: resume } : {}) })
    s.notify(`Escala ${sc.label} aplicada${all ? ' a todas as folhas' : ''}${resume ? ' — pode medir' : ''}`)
  }
  const fromCalib = () => {
    const n = parseFloat(val.replace(',', '.'))
    if (!n || !c.length) return
    const meters = unit === 'm' ? n : unit === 'cm' ? n / 100 : n / 1000
    const k = meters / c.length
    const approx = Math.round(k / paperScale(1))
    apply({ metersPerUnit: k, label: `≈1:${approx}` })
  }
  // fecha o diálogo e deixa o usuário traçar sobre uma cota conhecida
  const calibrateByDimension = () => {
    const back = s.tool !== 'calibrate' && s.tool !== 'select' ? s.tool : s.resumeTool
    s.set({ calibrating: null, tool: 'calibrate', resumeTool: back })
  }

  return (
    <div className="modal-back" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{vp ? `Escala do ${vp.text || 'viewport'}` : c.prompt ? 'Esta folha ainda não tem escala' : `Escala da folha — ${sheet?.label ?? ''}`}</h3>
        {c.length > 0 ? (
          <div className="stack">
            <p className="muted">Medida real do trecho que você traçou:</p>
            <div className="row">
              <input autoFocus className="grow" placeholder="ex.: 5,00" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fromCalib()} />
              <select value={unit} onChange={(e) => setUnit(e.target.value as 'm')}>
                <option>m</option><option>cm</option><option>mm</option>
              </select>
            </div>
            {val && parseFloat(val.replace(',', '.')) > 0 && (
              <p className="muted small">Resultado ≈ 1:{fmt(((unit === 'm' ? 1 : unit === 'cm' ? 0.01 : 0.001) * parseFloat(val.replace(',', '.'))) / c.length / paperScale(1), 0)}</p>
            )}
          </div>
        ) : (
          <div className="stack">
            {c.prompt && <p className="muted">Para medir comprimentos e áreas, defina a escala primeiro.</p>}
            <button className="choice" onClick={calibrateByDimension}>
              <Ruler size={18} />
              <span><b>Calibrar por uma cota</b><small>Trace sobre uma medida conhecida (com snap) e digite o valor real</small></span>
            </button>
            {found.length > 0 && (
              <button className="choice found" onClick={() => apply({ metersPerUnit: paperScale(found[0]), label: `1:${found[0]}` })}>
                <ScanSearch size={18} />
                <span><b>Usar 1:{found[0]}</b><small>Encontrada no carimbo da prancha{found.length > 1 ? ` (também: ${found.slice(1, 4).map((n) => `1:${n}`).join(', ')})` : ''}</small></span>
              </button>
            )}
            <span className="section-label">Ou escolha a escala de impressão</span>
            <div className="ratio-grid">
              {RATIOS.map((r) => (
                <button key={r} className={`btn sm ${ratio === String(r) ? 'primary' : ''}`} onClick={() => setRatio(String(r))}>1:{r}</button>
              ))}
            </div>
            <div className="row center">
              <span className="muted">1:</span>
              <input className="grow" value={ratio} onChange={(e) => setRatio(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
        )}
        {!vp && <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Aplicar a todas as folhas</label>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={close}>{c.prompt ? 'Agora não' : 'Cancelar'}</button>
          {c.length > 0 ? (
            <button className="btn primary" onClick={fromCalib}>Aplicar</button>
          ) : (
            <button className="btn primary" disabled={!Number(ratio)} onClick={() => apply({ metersPerUnit: paperScale(Number(ratio)), label: `1:${ratio}` })}>Aplicar 1:{ratio || '?'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
