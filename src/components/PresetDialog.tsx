import { useEffect, useRef, useState } from 'react'
import { Database, Search } from 'lucide-react'
import { uid, useStore } from '../store'
import type { Preset, SinapiItem } from '../types'
import { checkFormula } from '../formula'
import { loadBase, measureForUnit, searchBase } from '../sinapi'
import type { PriceBase } from '../sinapi'
import { fmt } from '../geometry'
import { PresetSwatch } from './RightPanel'
import { localeOf, t } from '../i18n'
import { Rich } from './Rich'

const BLANK: Omit<Preset, 'id'> = {
  name: '', group: 'Geral', code: '', measure: 'area', color: '#0090ff', opacity: 0.25, width: 1.5, dash: 'solid', pattern: 'solid',
  symbol: 'circle', letter: '', factor: 1, factorLabel: '', formula: '', resultUnit: 'm²', unitPrice: 0, showLabel: true,
}
const UNIT = { length: 'm', area: 'm²', count: 'un' } as const

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'span2' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

/**
 * Criar/editar marcador em pop-up. O rascunho é local: nada muda na lista enquanto você digita
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
  return (
    <div className="modal-back" onMouseDown={close}>
      <div className="modal wide preset-modal" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && !hits.length) save(); if (e.key === 'Escape') close() }}>
        <div className="row center">
          <PresetSwatch p={p} />
          <h3 className="grow">{original ? t('presetdialog.editar_marcador') : t('presetdialog.novo_marcador_de_quantitativo')}</h3>
        </div>

        <div className="sinapi-search">
          <Search size={14} />
          <input placeholder={base ? t('presetdialog.buscar_na_base_codigo_ou', { label: base.label }) : t('presetdialog.importe_a_base_sinapi_em')} value={q} disabled={!base} onChange={(e) => setQ(e.target.value)} />
          {base && <span className="muted small">{t('presetdialog.itens', { toLocaleString: base.items.length.toLocaleString(localeOf()) })}</span>}
          {hits.length > 0 && (
            <div className="sinapi-hits">
              {hits.map((it) => (
                <button key={it.code} onClick={() => pick(it)}>
                  <span className="mono">{it.code}</span>
                  <span className="grow">{it.desc}</span>
                  <span className="muted">{it.unit}</span>
                  <b>R$ {fmt(it.price)}</b>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid2">
          <F label={t('presetdialog.nome')} wide><input ref={nameRef} autoFocus value={p.name} placeholder={t('presetdialog.ex_porcelanato_60_60_retificado')} onChange={(e) => up({ name: e.target.value })} /></F>
          <F label={t('presetdialog.grupo_disciplina')}>
            <input value={p.group} list="preset-groups" onChange={(e) => up({ group: e.target.value })} />
            <datalist id="preset-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </F>
          <F label={t('presetdialog.codigo_sinapi_proprio')}><input value={p.code} onChange={(e) => up({ code: e.target.value })} /></F>
          <F label={t('presetdialog.tipo_de_medida')}>
            <select value={p.measure} onChange={(e) => { const m = e.target.value as Preset['measure']; up({ measure: m, resultUnit: p.resultUnit === UNIT[p.measure] ? UNIT[m] : p.resultUnit }) }}>
              <option value="area">{t('presetdialog.area')}</option><option value="length">{t('presetdialog.comprimento')}</option><option value="count">{t('presetdialog.contagem')}</option>
            </select>
          </F>
          <F label={t('presetdialog.cor')}><input type="color" value={p.color} onChange={(e) => up({ color: e.target.value })} /></F>
          {p.measure !== 'count' ? (
            <>
              <F label={t('presetdialog.espessura_do_traco')}><input type="number" min={0.25} step={0.25} value={p.width} onChange={(e) => up({ width: Number(e.target.value) })} /></F>
              <F label={t('presetdialog.estilo_do_traco')}>
                <select value={p.dash} onChange={(e) => up({ dash: e.target.value as Preset['dash'] })}>
                  <option value="solid">{t('presetdialog.continuo')}</option><option value="dash">{t('presetdialog.tracejado')}</option><option value="dot">{t('presetdialog.pontilhado')}</option>
                </select>
              </F>
            </>
          ) : (
            <>
              <F label={t('presetdialog.simbolo')}>
                <select value={p.symbol} onChange={(e) => up({ symbol: e.target.value as Preset['symbol'] })}>
                  <option value="circle">{t('presetdialog.circulo')}</option><option value="square">{t('presetdialog.quadrado')}</option><option value="triangle">{t('presetdialog.triangulo')}</option><option value="diamond">{t('presetdialog.losango')}</option><option value="cross">{t('presetdialog.xis')}</option><option value="letter">{t('presetdialog.letra')}</option>
                </select>
              </F>
              <F label={t('presetdialog.letra')}><input maxLength={2} value={p.letter} onChange={(e) => up({ letter: e.target.value.toUpperCase() })} /></F>
            </>
          )}
          {p.measure === 'area' && (
            <>
              <F label={t('presetdialog.hachura')}>
                <select value={p.pattern} onChange={(e) => up({ pattern: e.target.value as Preset['pattern'] })}>
                  <option value="solid">{t('presetdialog.solida')}</option><option value="hatch">{t('presetdialog.diagonal')}</option><option value="cross">{t('presetdialog.xadrez')}</option><option value="dots">{t('presetdialog.pontos')}</option><option value="none">{t('presetdialog.sem_preenchimento')}</option>
                </select>
              </F>
              <F label={t('presetdialog.opacidade', { round: Math.round(p.opacity * 100) })}><input type="range" min={0} max={0.9} step={0.05} value={p.opacity} onChange={(e) => up({ opacity: Number(e.target.value) })} /></F>
            </>
          )}
          <F label={t('presetdialog.fator_h')}><input type="number" step={0.01} value={p.factor} onChange={(e) => up({ factor: Number(e.target.value) })} /></F>
          <F label={t('presetdialog.o_que_e_o_fator')}><input value={p.factorLabel} placeholder={t('presetdialog.ex_pe_direito_m')} onChange={(e) => up({ factorLabel: e.target.value })} /></F>
          <F label={t('presetdialog.formula_opcional')} wide>
            <input className={err ? 'invalid' : ''} value={p.formula} placeholder={p.measure === 'area' ? t('presetdialog.ex_a_p_h_a') : p.measure === 'length' ? 'ex.: L * 1,05' : t('presetdialog.ex_ceil_n_10')} onChange={(e) => up({ formula: e.target.value })} />
          </F>
          <div className="hint span2">{err ? <span className="warn">{err}</span> : <Rich k="presetdialog.variaveis_ajuda" />}</div>
          <F label={t('presetdialog.unidade_final')}><input value={p.resultUnit} onChange={(e) => up({ resultUnit: e.target.value })} /></F>
          <F label={t('presetdialog.preco_unitario_r')}><input type="number" step={0.01} value={p.unitPrice} onChange={(e) => up({ unitPrice: Number(e.target.value) })} /></F>
          <label className="check span2"><input type="checkbox" checked={p.showLabel} onChange={(e) => up({ showLabel: e.target.checked })} /> {t('presetdialog.mostrar_o_valor_medido_na')}</label>
        </div>

        <div className="modal-actions">
          {!base && <span className="muted small grow"><Database size={12} /> {t('presetdialog.sem_base_de_precos_importada')}</span>}
          <button className="btn ghost" onClick={close}>{t('presetdialog.cancelar')}</button>
          <button className="btn primary" disabled={!p.name.trim() || !!err} onClick={save}>{original ? t('presetdialog.salvar') : t('presetdialog.criar_marcador')}</button>
        </div>
      </div>
    </div>
  )
}
