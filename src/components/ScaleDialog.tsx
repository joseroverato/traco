import { useEffect, useState } from 'react'
import { Ruler, ScanSearch } from 'lucide-react'
import { useStore } from '../store'
import { fmt, paperScale } from '../geometry'
import { detectScales } from '../pdf'
import type { PageScale } from '../types'
import { t } from '../i18n'

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
      s.notify(t('scaledialog.escala_aplicada_ao', { label: sc.label, nome: vp.text || 'viewport' }))
      return
    }
    const scales = { ...s.scales }
    if (all) s.sheets.forEach((sh) => (scales[sh.id] = sc))
    else scales[c.page] = sc
    s.set({ scales, calibrating: null, resumeTool: null, ...(resume ? { tool: resume } : {}) })
    s.notify(t(all ? 'scaledialog.aplicada_todas' : 'scaledialog.aplicada', { label: sc.label }) + (resume ? t('scaledialog.pode_medir') : ''))
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
        <h3>{vp ? t('scaledialog.escala_do', { nome: vp.text || 'viewport' }) : c.prompt ? t('scaledialog.esta_folha_ainda_nao_tem') : t('scaledialog.escala_da_folha', { label: sheet?.label ?? '' })}</h3>
        {c.length > 0 ? (
          <div className="stack">
            <p className="muted">{t('scaledialog.medida_real_do_trecho_que')}</p>
            <div className="row">
              <input autoFocus className="grow" placeholder="ex.: 5,00" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fromCalib()} />
              <select value={unit} onChange={(e) => setUnit(e.target.value as 'm')}>
                <option>m</option><option>cm</option><option>mm</option>
              </select>
            </div>
            {val && parseFloat(val.replace(',', '.')) > 0 && (
              <p className="muted small">{t('scaledialog.resultado_1', { n: fmt(((unit === 'm' ? 1 : unit === 'cm' ? 0.01 : 0.001) * parseFloat(val.replace(',', '.'))) / c.length / paperScale(1), 0) })}</p>
            )}
          </div>
        ) : (
          <div className="stack">
            {c.prompt && <p className="muted">{t('scaledialog.para_medir_comprimentos_e_areas')}</p>}
            <button className="choice" onClick={calibrateByDimension}>
              <Ruler size={18} />
              <span><b>{t('scaledialog.calibrar_por_uma_cota')}</b><small>{t('scaledialog.trace_sobre_uma_medida_conhecida')}</small></span>
            </button>
            {found.length > 0 && (
              <button className="choice found" onClick={() => apply({ metersPerUnit: paperScale(found[0]), label: `1:${found[0]}` })}>
                <ScanSearch size={18} />
                <span><b>{t('scaledialog.usar_1', { v: found[0] })}</b><small>{t('scaledialog.encontrada_no_carimbo')}{found.length > 1 ? t('scaledialog.tambem', { lista: found.slice(1, 4).map((n) => `1:${n}`).join(', ') }) : ''}</small></span>
              </button>
            )}
            <span className="section-label">{t('scaledialog.ou_escolha_a_escala_de')}</span>
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
        {!vp && <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('scaledialog.aplicar_a_todas_as_folhas')}</label>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={close}>{c.prompt ? t('scaledialog.agora_nao') : t('scaledialog.cancelar')}</button>
          {c.length > 0 ? (
            <button className="btn primary" onClick={fromCalib}>{t('scaledialog.aplicar')}</button>
          ) : (
            <button className="btn primary" disabled={!Number(ratio)} onClick={() => apply({ metersPerUnit: paperScale(Number(ratio)), label: `1:${ratio}` })}>{t('scaledialog.aplicar_1', { ratio: ratio || '?' })}</button>
          )}
        </div>
      </div>
    </div>
  )
}
