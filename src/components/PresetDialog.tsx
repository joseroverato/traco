import { useEffect, useRef, useState } from 'react'
import { uid, useStore } from '../store'
import type { Preset, SinapiItem } from '../types'
import { checkFormula } from '../formula'
import { loadBase, measureForUnit, searchBase } from '../sinapi'
import type { PriceBase } from '../sinapi'
import { fmt } from '../geometry'
import { PresetSwatch } from './RightPanel'
import { localeOf, t } from '../i18n'
import { Rich } from './Rich'
import { Chk, ColorField, Dlg, Sld } from './Dlg'
import { Glyph } from './Icon'
import { SelectCb } from './pal/SelectCb'

const BLANK: Omit<Preset, 'id'> = {
  name: '', group: 'Geral', code: '', measure: 'area', color: '#0090ff', opacity: 0.25, width: 1.5, dash: 'solid', pattern: 'solid',
  symbol: 'circle', letter: '', factor: 1, factorLabel: '', formula: '', resultUnit: 'm²', unitPrice: 0, showLabel: true,
}
const UNIT = { length: 'm', area: 'm²', count: 'un' } as const

/**
 * Criar/editar marcador em diálogo. O rascunho é local: nada muda na lista enquanto você digita
 * (antes o item mudava de grupo a cada letra e o campo perdia o foco).
 */
export function PresetDialog() {
  const s = useStore()
  const d = s.presetDialog!
  const original = d.id ? s.presets.find((p) => p.id === d.id) : undefined
  const [p, setP] = useState<Preset>(() => ({ ...BLANK, ...(original ?? {}), ...(d.draft ?? {}), id: original?.id ?? uid() }))
  const [base, setBase] = useState<PriceBase | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SinapiItem[]>([])
  const nameRef = useRef<HTMLInputElement>(null)
  const groups = Array.from(new Set(s.presets.map((x) => x.group)))
  const up = (patch: Partial<Preset>) => setP((x) => ({ ...x, ...patch }))
  const close = () => s.set({ presetDialog: null })

  useEffect(() => {
    loadBase().then(setBase)
    setTimeout(() => nameRef.current?.focus(), 30)
  }, [])
  useEffect(() => setHits(searchBase(base, q, 40)), [q, base])

  const pick = (it: SinapiItem) => {
    const measure = original ? p.measure : measureForUnit(it.unit)
    up({ code: it.code, name: p.name || it.desc.slice(0, 90), unitPrice: Math.round(it.price * 100) / 100, resultUnit: it.unit, measure })
    setQ('')
  }

  const save = () => {
    if (!p.name.trim()) return nameRef.current?.focus()
    const next = { ...p, name: p.name.trim(), group: p.group.trim() || 'Geral' }
    if (original) {
      s.setPresets(s.presets.map((x) => (x.id === next.id ? next : x)))
      useStore.setState({ markups: useStore.getState().markups.map((m) => (m.presetId === next.id ? { ...m, color: next.color, fill: next.color, width: next.width, fillOpacity: next.opacity } : m)) })
      s.notify(t('presetdialog.marcador_atualizado'))
    } else {
      s.setPresets([next, ...s.presets]) // novo marcador entra no topo
      s.set({ activePreset: next.id, tool: next.measure, selected: [] })
      s.notify(t('presetdialog.marcador_criado_e_ativado', { name: next.name }))
    }
    close()
  }

  const err = p.formula ? checkFormula(p.formula) : null
  const measureName = (m: Preset['measure']) => (m === 'area' ? t('presetdialog.area') : m === 'length' ? t('presetdialog.comprimento') : t('presetdialog.contagem'))
  const opac = Math.round(p.opacity * 100)
  return (
    <Dlg
      title={original ? t('presetdialog.editar_marcador') : t('presetdialog.novo_marcador_de_quantitativo')}
      onClose={close}
      className="mk"
      width={1080}
      bodyClass="mkp"
      lead={<PresetSwatch p={p} />}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'SELECT' && !hits.length) save() }}
      footer={<>
        {!base && <span className="arq"><Glyph name="alerta" size={12} /><span>{t('presetdialog.sem_base_de_precos_importada')}</span></span>}
        <button type="button" className="btn" onClick={close}>{t('presetdialog.cancelar')}</button>
        <button type="button" className="btn pri" disabled={!p.name.trim() || !!err} onClick={save}>{original ? t('presetdialog.salvar') : t('presetdialog.criar_marcador')}</button>
      </>}
    >
      <div className="mk-b">
        <div className="mk-c">
          <div className="gbx"><h3>{t('presetdialog.base_de_precos')}</h3>
            <label className="fld"><span>{t('presetdialog.buscar')}</span>
              <input className="in" type="search" value={q} disabled={!base} aria-label={base ? t('presetdialog.buscar_na_base_codigo_ou', { label: base.label }) : t('presetdialog.importe_a_base_sinapi_em')} placeholder={base ? t('presetdialog.buscar_na_base_codigo_ou', { label: base.label }) : t('presetdialog.importe_a_base_sinapi_em')} onChange={(e) => setQ(e.target.value)} />
              {base && <span className="un n">{t('presetdialog.itens', { toLocaleString: base.items.length.toLocaleString(localeOf()) })}</span>}
            </label>
            {hits.length > 0 && (
              <div className="res rol" aria-label={t('presetdialog.itens_encontrados')}>
                {hits.map((it) => (
                  <button key={it.code} type="button" onClick={() => pick(it)}>
                    <span className="c n">{it.code}</span>
                    <span className="d">{it.desc}</span>
                    <span className="mut">{it.unit}</span>
                    <b className="n">R$ {fmt(it.price)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="gbx"><h3>{t('presetdialog.identificacao')}</h3>
            <label className="fld"><span>{t('presetdialog.nome')}</span><input ref={nameRef} className="in" value={p.name} placeholder={t('presetdialog.ex_porcelanato_60_60_retificado')} onChange={(e) => up({ name: e.target.value })} /></label>
            <label className="fld"><span>{t('presetdialog.grupo_disciplina')}</span>
              <input className="in" value={p.group} list="preset-groups" onChange={(e) => up({ group: e.target.value })} />
              <datalist id="preset-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            </label>
            <label className="fld"><span>{t('presetdialog.codigo_sinapi_proprio')}</span><input className="in n" value={p.code} onChange={(e) => up({ code: e.target.value })} /></label>
          </div>
          <div className="gbx"><h3>{t('presetdialog.medida_e_calculo')}</h3>
            <div className="fld"><span>{t('presetdialog.tipo_de_medida')}</span>
              <SelectCb value={p.measure} onChange={(v) => { const m = v as Preset['measure']; up({ measure: m, resultUnit: p.resultUnit === UNIT[p.measure] ? UNIT[m] : p.resultUnit }) }} label={t('presetdialog.tipo_de_medida')} current={measureName(p.measure)}>
                <option value="area">{t('presetdialog.area')}</option><option value="length">{t('presetdialog.comprimento')}</option><option value="count">{t('presetdialog.contagem')}</option>
              </SelectCb>
            </div>
            <div className="f2">
              <label className="fld"><span>{t('presetdialog.fator_h')}</span><input className="in n" type="number" step={0.01} value={p.factor} onChange={(e) => up({ factor: Number(e.target.value) })} /></label>
              <label className="fld au"><span>{t('presetdialog.o_que_e_o_fator')}</span><input className="in" value={p.factorLabel} placeholder={t('presetdialog.ex_pe_direito_m')} onChange={(e) => up({ factorLabel: e.target.value })} /></label>
            </div>
            <label className="fld"><span>{t('presetdialog.formula_opcional')}</span>
              <input className={`in n ${err ? 'invalid' : ''}`} value={p.formula} placeholder={p.measure === 'area' ? t('presetdialog.ex_a_p_h_a') : p.measure === 'length' ? 'ex.: L * 1,05' : t('presetdialog.ex_ceil_n_10')} onChange={(e) => up({ formula: e.target.value })} />
            </label>
            <p className="nt">{err ? <span className="warnl" role="alert">{err}</span> : <Rich k="presetdialog.variaveis_ajuda" />}</p>
            <div className="f2">
              <label className="fld"><span>{t('presetdialog.unidade_final')}</span><input className="in" value={p.resultUnit} onChange={(e) => up({ resultUnit: e.target.value })} /></label>
              <label className="fld au"><span>{t('presetdialog.preco_unitario_r')}</span><input className="in n" type="number" step={0.01} value={p.unitPrice} onChange={(e) => up({ unitPrice: Number(e.target.value) })} /></label>
            </div>
          </div>
        </div>
        <div className="mk-c">
          <div className="gbx"><h3>{t('dialogs.aparencia')}</h3>
            <div className="f2">
              <div className="fld au cfx"><span>{t('presetdialog.cor')}</span><ColorField className="w112" value={p.color} onChange={(c) => up({ color: c })} label={t('presetdialog.cor')} /></div>
              {p.measure !== 'count' && <label className="fld au"><span>{t('presetdialog.espessura_do_traco')}</span><input className="in n" type="number" min={0.25} step={0.25} value={p.width} onChange={(e) => up({ width: Number(e.target.value) })} /></label>}
            </div>
            {p.measure !== 'count' ? (
              <div className="fld"><span>{t('presetdialog.estilo_do_traco')}</span>
                <SelectCb value={p.dash} onChange={(v) => up({ dash: v as Preset['dash'] })} label={t('presetdialog.estilo_do_traco')} current={p.dash === 'solid' ? t('presetdialog.continuo') : p.dash === 'dash' ? t('presetdialog.tracejado') : t('presetdialog.pontilhado')}>
                  <option value="solid">{t('presetdialog.continuo')}</option><option value="dash">{t('presetdialog.tracejado')}</option><option value="dot">{t('presetdialog.pontilhado')}</option>
                </SelectCb>
              </div>
            ) : (
              <>
                <div className="fld"><span>{t('presetdialog.simbolo')}</span>
                  <SelectCb value={p.symbol} onChange={(v) => up({ symbol: v as Preset['symbol'] })} label={t('presetdialog.simbolo')} current={{ circle: t('presetdialog.circulo'), square: t('presetdialog.quadrado'), triangle: t('presetdialog.triangulo'), diamond: t('presetdialog.losango'), cross: t('presetdialog.xis'), letter: t('presetdialog.letra') }[p.symbol]}>
                    <option value="circle">{t('presetdialog.circulo')}</option><option value="square">{t('presetdialog.quadrado')}</option><option value="triangle">{t('presetdialog.triangulo')}</option><option value="diamond">{t('presetdialog.losango')}</option><option value="cross">{t('presetdialog.xis')}</option><option value="letter">{t('presetdialog.letra')}</option>
                  </SelectCb>
                </div>
                <label className="fld"><span>{t('presetdialog.letra')}</span><input className="in" maxLength={2} value={p.letter} onChange={(e) => up({ letter: e.target.value.toUpperCase() })} /></label>
              </>
            )}
            {p.measure === 'area' && (
              <>
                <div className="fld"><span>{t('presetdialog.hachura')}</span>
                  <SelectCb value={p.pattern} onChange={(v) => up({ pattern: v as Preset['pattern'] })} label={t('presetdialog.hachura')} current={{ solid: t('presetdialog.solida'), hatch: t('presetdialog.diagonal'), cross: t('presetdialog.xadrez'), dots: t('presetdialog.pontos'), none: t('presetdialog.sem_preenchimento') }[p.pattern]}>
                    <option value="solid">{t('presetdialog.solida')}</option><option value="hatch">{t('presetdialog.diagonal')}</option><option value="cross">{t('presetdialog.xadrez')}</option><option value="dots">{t('presetdialog.pontos')}</option><option value="none">{t('presetdialog.sem_preenchimento')}</option>
                  </SelectCb>
                </div>
                <div className="fld"><span>{t('presetdialog.opacidade', { round: opac })}</span><Sld min={0} max={0.9} step={0.05} value={p.opacity} onChange={(v) => up({ opacity: v })} label={t('presetdialog.opacidade', { round: opac })} valueText={`${opac}%`} /></div>
              </>
            )}
            <div className="opcfld"><Chk checked={p.showLabel} onChange={(v) => up({ showLabel: v })}>{t('presetdialog.mostrar_o_valor_medido_na')}</Chk></div>
          </div>
        </div>
      </div>
    </Dlg>
  )
}
