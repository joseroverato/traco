import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { CALIB_UNITS, IMPERIAL_SCALES, getUnits, parseLength } from '../units'
import { fmt, paperScale } from '../geometry'
import { detectScales } from '../pdf'
import type { PageScale } from '../types'
import { t } from '../i18n'
import { Chk, Dlg } from './Dlg'
import { Icon } from './Icon'
import { SelectCb } from './pal/SelectCb'

const RATIOS = [20, 25, 50, 75, 100, 125, 200, 250, 500, 1000]

/**
 * Escala da folha (e de um viewport). Variantes: pedido ao abrir folha sem escala, escolha da escala (métrica ou imperial),
 * viewport (sem "aplicar a todas") e calibrar por uma cota (medida real do trecho traçado).
 */
export function ScaleDialog() {
  const s = useStore()
  const c = s.calibrating
  const [val, setVal] = useState('')
  const system = getUnits()
  const [unit, setUnit] = useState<string>(CALIB_UNITS[system][0].id)
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

  const close = () => s.set({ calibrating: null, resumeTool: null })
  // Esc fecha mesmo que o foco tenha saído da janela (clique no fundo, toque, troca de ferramenta pelo teclado)
  const open = !!c
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null
  const vp = c.viewport ? s.markups.find((m) => m.id === c.viewport) : undefined

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
  const typed = parseLength(val, unit as 'm') ?? 0
  const fromCalib = () => {
    const meters = parseLength(val, unit as 'm')
    if (!meters || !c.length) return
    const k = meters / c.length
    const approx = Math.round(k / paperScale(1))
    apply({ metersPerUnit: k, label: `≈1:${approx}` })
  }
  // fecha o diálogo e deixa o usuário traçar sobre uma cota conhecida
  const calibrateByDimension = () => {
    const back = s.tool !== 'calibrate' && s.tool !== 'select' ? s.tool : s.resumeTool
    s.set({ calibrating: null, tool: 'calibrate', resumeTool: back })
  }
  const labelOf = (n: number) => (system === 'imperial' ? IMPERIAL_SCALES.find((r) => r.n === n)?.label ?? `1:${n}` : `1:${n}`)
  const list: { n: number; label: string }[] = system === 'imperial' ? IMPERIAL_SCALES.map((r) => ({ n: r.n, label: r.label })) : RATIOS.map((r) => ({ n: r, label: `1:${r}` }))
  const title = vp ? t('scaledialog.escala_do', { nome: vp.text || 'viewport' }) : c.prompt ? t('scaledialog.esta_folha_ainda_nao_tem') : t('scaledialog.escala_da_folha', { label: sheet?.label ?? '' })
  const applyRatio = () => apply({ metersPerUnit: paperScale(Number(ratio)), label: labelOf(Number(ratio)) })

  return (
    <Dlg
      title={title}
      onClose={close}
      width={c.length > 0 ? 440 : 626}
      footer={<>
        <button type="button" className="btn" onClick={close}>{c.prompt ? t('scaledialog.agora_nao') : t('scaledialog.cancelar')}</button>
        {c.length > 0
          ? <button type="button" className="btn pri" disabled={typed <= 0} onClick={fromCalib}>{t('scaledialog.aplicar')}</button>
          : <button type="button" className="btn pri" disabled={!Number(ratio)} onClick={applyRatio}>{t('scaledialog.aplicar_1', { ratio: ratio || '?' })}</button>}
      </>}
    >
      {c.length > 0 ? (
        <>
          <p>{t('scaledialog.medida_real_do_trecho_que')}</p>
          <div className="fld">
            <input className="in n" aria-label={t('scaledialog.medida_real_do_trecho_que')} placeholder={system === 'imperial' ? "ex.: 12'-6\"" : 'ex.: 5,00'} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fromCalib()} />
            <SelectCb className="un" value={unit} onChange={setUnit} label={t('scaledialog.unidade')} current={unit}>
              {CALIB_UNITS[system].map((u) => <option key={u.id} value={u.id}>{u.id}</option>)}
            </SelectCb>
          </div>
          {typed > 0 && <p className="rsl">{t('scaledialog.resultado_1', { n: fmt(typed / c.length / paperScale(1), 0) })}</p>}
        </>
      ) : (
        <>
          {c.prompt && <p>{t('scaledialog.para_medir_comprimentos_e_areas')}</p>}
          <div className="d2">
            <div className="gbx esc">
              <h3>{t('scaledialog.escala_de_impressao')}</h3>
              <div className="lbx" role="listbox" aria-label={t('scaledialog.escala_de_impressao')}>
                {list.map((r) => (
                  <button key={r.label} type="button" role="option" aria-selected={ratio === String(r.n)} className={`lbi ${ratio === String(r.n) ? 'on' : ''}`} title={`1:${r.n}`} onClick={() => setRatio(String(r.n))}><span className="n">{r.label}</span></button>
                ))}
              </div>
              <label className="fld">
                <span>{t('scaledialog.outra_escala')}</span>
                <span className="pre">1:</span>
                <input className="in n" aria-label={t('scaledialog.outra_escala')} value={ratio} inputMode="numeric" onChange={(e) => setRatio(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && Number(ratio) && applyRatio()} />
              </label>
            </div>
            <div className="d2r">
              {found.length > 0 && (
                <div className="gbx">
                  <h3>{t('scaledialog.lida_do_carimbo')}</h3>
                  <div className="lin">
                    <span>{t('scaledialog.encontrada_no_carimbo')}{found.length > 1 ? t('scaledialog.tambem', { lista: found.slice(1, 4).map((n) => `1:${n}`).join(', ') }) : ''}</span>
                    <button type="button" className="tbn txt" onClick={() => apply({ metersPerUnit: paperScale(found[0]), label: `1:${found[0]}` })}>{t('scaledialog.usar_1', { v: found[0] })}</button>
                  </div>
                </div>
              )}
              <div className="gbx">
                <h3>{t('scaledialog.calibrar_por_uma_cota')}</h3>
                <div className="lin">
                  <span className="wr2">{t('scaledialog.trace_sobre_uma_medida_conhecida')}</span>
                  <button type="button" className="tbn" onClick={calibrateByDimension}><Icon name="calibrar" size={16} />{t('railtools.calibrar_escala')}</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {!vp && <Chk checked={all} onChange={setAll}>{t('scaledialog.aplicar_a_todas_as_folhas')}</Chk>}
    </Dlg>
  )
}
