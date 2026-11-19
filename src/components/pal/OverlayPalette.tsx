import { useRef, useState } from 'react'
import { curSheet, useStore } from '../../store'
import { addSourceOnly } from '../../project'
import { addOverlay, overlaysOf, resetOverlay, startAlign, updateOverlay, saveOverlays } from '../../overlayOps'
import { Glyph, Icon } from '../Icon'
import { SelectCb } from './SelectCb'
import { Rich } from '../Rich'
import { t } from '../../i18n'

/** Sobreposição de disciplinas sobre a folha atual: adicionar, intensidade, alinhar por 2 pontos, zerar. */
export function OverlayPalette() {
  const sheets = useStore((s) => s.sheets)
  const page = useStore((s) => s.page)
  const sh = useStore((s) => curSheet(s))
  const overlays = useStore((s) => s.overlays)
  const aligning = useStore((s) => s.aligning)
  const list = overlaysOf({ sheets, page, overlays })
  const [extra, setExtra] = useState<{ src: string; srcIndex: number; label: string }[]>([])
  const [pick, setPick] = useState('')
  const input = useRef<HTMLInputElement>(null)
  if (!sh) return <p className="pvz">{t('overlaypanel.abra_um_pdf')}</p>

  const options = [
    ...sheets.filter((x) => x.id !== sh.id).map((x) => ({ key: `s:${x.id}`, label: x.label, src: x.src, srcIndex: x.srcIndex, rot: x.rot })),
    ...extra.map((x, i) => ({ key: `e:${i}`, label: x.label, src: x.src, srcIndex: x.srcIndex, rot: 0 })),
  ]
  const cur = options.find((x) => x.key === pick) ?? options[0]
  const loadPdf = async (f: File) => {
    const { src, sheets: loaded } = await addSourceOnly(f)
    const add = loaded.map((x) => ({ src: src.id, srcIndex: x.srcIndex, label: `${f.name.replace(/\.pdf$/i, '')} · ${x.label}` }))
    setExtra([...extra, ...add])
    setPick(`e:${extra.length}`)
  }

  return (
    <div>
      <p className="pvz"><Rich k="overlaypanel.nota" vars={{ label: sh.label }} /></p>
      <div className="pbar">
        <SelectCb className="grow" value={cur?.key ?? ''} onChange={setPick} label={t('overlaypanel.adicionar_disciplina')} current={cur?.label ?? t('overlaypanel.carregue_outro_pdf')} disabled={!options.length}>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </SelectCb>
      </div>
      <div className="pbar">
        <button type="button" className="tbn pri" disabled={!cur} onClick={() => cur && addOverlay(cur)}><Icon name="adicionarDisciplina" size={16} />{t('overlaypanel.sobrepor')}</button>
        <button type="button" className="tbn" onClick={() => input.current?.click()}><Icon name="outroPdf" size={16} />{t('overlaypanel.outro_pdf')}</button>
      </div>
      {list.length > 0 && <div className="pc-h"><Glyph name="down" size={10} /><span>{t('overlaypanel.disciplinas_sobrepostas')}</span></div>}
      {list.map((o) => (
        <div key={o.id} className="ovb">
          <div className="pbar">
            <input type="color" className="in cor-in" value={o.color} aria-label={t('pal.cor')} onChange={(e) => updateOverlay(sh.id, o.id, { color: e.target.value })} />
            <input className="in" value={o.label} aria-label={t('pal.nome')} onChange={(e) => updateOverlay(sh.id, o.id, { label: e.target.value })} />
            <button type="button" className="ib" role="switch" aria-checked={o.visible} aria-label={o.visible ? t('pal.ocultar') : t('pal.mostrar')} title={o.visible ? t('pal.ocultar') : t('pal.mostrar')} onClick={() => updateOverlay(sh.id, o.id, { visible: !o.visible })}>
              <span className="ck">{o.visible && <Glyph name="check" size={10} />}</span>
            </button>
            <button type="button" className="ib" aria-label={t('rightpanel.remover')} title={t('rightpanel.remover')} onClick={() => saveOverlays(sh.id, list.filter((x) => x.id !== o.id))}><Glyph name="x" size={12} /></button>
          </div>
          <label className="ovi"><span className="k">{t('overlaypanel.intensidade', { round: Math.round(o.opacity * 100) })}</span>
            <input type="range" min={0.1} max={1} step={0.05} value={o.opacity} onChange={(e) => updateOverlay(sh.id, o.id, { opacity: Number(e.target.value) })} />
          </label>
          <div className="pbar">
            <button type="button" className={`tbn${aligning?.overlay === o.id ? ' pri' : ''}`} onClick={() => startAlign(o.id)}><Icon name="alinhar" size={16} />{t('overlaypanel.alinhar_por_2_pontos')}</button>
            <button type="button" className="tbn txt" onClick={() => resetOverlay(sh.id, o.id)}><Icon name="zerar" size={16} />{t('overlaypanel.zerar')}</button>
          </div>
        </div>
      ))}
      <input ref={input} type="file" accept=".pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPdf(f); e.target.value = '' }} />
    </div>
  )
}
