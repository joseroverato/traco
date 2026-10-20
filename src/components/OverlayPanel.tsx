import { useRef, useState } from 'react'
import { Crosshair, Eye, EyeOff, FileUp, Plus, Trash2 } from 'lucide-react'
import { curSheet, uid, useStore } from '../store'
import { addSourceOnly } from '../project'
import type { Overlay } from '../types'
import { t } from '../i18n'
import { Rich } from './Rich'

const COLORS = ['#e5484d', '#0090ff', '#30a46c', '#f76b15', '#8e4ec6', '#d6409f']

/** Sobreposição de disciplinas sobre a folha atual (compatibilização). */
export function OverlayPanel() {
  const s = useStore()
  const sh = curSheet(s)
  const [extra, setExtra] = useState<{ src: string; srcIndex: number; label: string }[]>([])
  const [pick, setPick] = useState('')
  const input = useRef<HTMLInputElement>(null)
  if (!sh) return <p className="muted pad">{t('overlaypanel.abra_um_pdf')}</p>
  const list = s.overlays[sh.id] ?? []
  const save = (next: Overlay[]) => s.set({ overlays: { ...s.overlays, [sh.id]: next } })
  const upd = (id: string, patch: Partial<Overlay>) => save(list.map((o) => (o.id === id ? { ...o, ...patch } : o)))

  const options = [
    ...s.sheets.filter((x) => x.id !== sh.id).map((x) => ({ key: `s:${x.id}`, label: x.label, src: x.src, srcIndex: x.srcIndex, rot: x.rot })),
    ...extra.map((x, i) => ({ key: `e:${i}`, label: x.label, src: x.src, srcIndex: x.srcIndex, rot: 0 })),
  ]
  const add = () => {
    const o = options.find((x) => x.key === pick) ?? options[0]
    if (!o) return
    const ov: Overlay = { id: uid(), src: o.src, srcIndex: o.srcIndex, rot: o.rot, label: o.label, color: COLORS[list.length % COLORS.length], opacity: 0.85, visible: true, matrix: [1, 0, 0, 1, 0, 0] }
    save([...list, ov])
    s.notify(t('overlaypanel.sobreposta_se_nao_coincidir_use', { label: o.label }))
  }
  const loadPdf = async (f: File) => {
    const { src, sheets } = await addSourceOnly(f)
    const add = sheets.map((x) => ({ src: src.id, srcIndex: x.srcIndex, label: `${f.name.replace(/\.pdf$/i, '')} · ${x.label}` }))
    setExtra([...extra, ...add])
    setPick(`e:${extra.length}`)
  }

  return (
    <div className="dock-body">
      <p className="muted small dock-note"><Rich k="overlaypanel.nota" vars={{ label: sh.label }} /></p>
      <div className="dock-group">{t('overlaypanel.adicionar_disciplina')}</div>
      <div className="stack tight" style={{ padding: '0 4px' }}>
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          {!options.length && <option value="">{t('overlaypanel.carregue_outro_pdf')}</option>}
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <div className="row">
          <button className="btn sm primary" disabled={!options.length} onClick={add}><Plus size={13} /> {t('overlaypanel.sobrepor')}</button>
          <button className="btn sm" onClick={() => input.current?.click()}><FileUp size={13} /> {t('overlaypanel.outro_pdf')}</button>
        </div>
      </div>
      {list.length > 0 && <div className="dock-group">{t('overlaypanel.disciplinas_sobrepostas')}</div>}
      {list.map((o) => (
        <div key={o.id} className="ov-card">
          <div className="row center">
            <input type="color" className="color-sm" value={o.color} onChange={(e) => upd(o.id, { color: e.target.value })} />
            <input className="grow ov-name" value={o.label} onChange={(e) => upd(o.id, { label: e.target.value })} />
            <button className="icon-btn xs" onClick={() => upd(o.id, { visible: !o.visible })}>{o.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
            <button className="icon-btn xs" onClick={() => save(list.filter((x) => x.id !== o.id))}><Trash2 size={14} /></button>
          </div>
          <label className="field"><span>{t('overlaypanel.intensidade', { round: Math.round(o.opacity * 100) })}</span><input type="range" min={0.1} max={1} step={0.05} value={o.opacity} onChange={(e) => upd(o.id, { opacity: Number(e.target.value) })} /></label>
          <div className="row">
            <button className={`btn sm ${s.aligning?.overlay === o.id ? 'primary' : ''}`} onClick={() => s.set({ aligning: { overlay: o.id, step: 0, pts: [] }, tool: 'select', mode: 'review' })}><Crosshair size={13} /> {t('overlaypanel.alinhar_por_2_pontos')}</button>
            <button className="btn sm ghost" onClick={() => upd(o.id, { matrix: [1, 0, 0, 1, 0, 0] })}>{t('overlaypanel.zerar')}</button>
          </div>
        </div>
      ))}
      <input ref={input} type="file" accept=".pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPdf(f); e.target.value = '' }} />
    </div>
  )
}
