import { useEffect, useRef, useState } from 'react'
import { Database, Search } from 'lucide-react'
import { uid, useStore } from '../store'
import type { Preset, SinapiItem } from '../types'
import { checkFormula } from '../formula'
import { loadBase, measureForUnit, searchBase } from '../sinapi'
import type { PriceBase } from '../sinapi'
import { fmt } from '../geometry'
import { PresetSwatch } from './RightPanel'

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
      s.notify('Marcador atualizado')
    } else {
      s.setPresets([next, ...s.presets]) // novo marcador entra no topo
      s.set({ activePreset: next.id, tool: next.measure, selected: [] })
      s.notify(`Marcador "${next.name}" criado e ativado`)
    }
    close()
  }

  const err = p.formula ? checkFormula(p.formula) : null
  return (
    <div className="modal-back" onMouseDown={close}>
      <div className="modal wide preset-modal" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && !hits.length) save(); if (e.key === 'Escape') close() }}>
        <div className="row center">
          <PresetSwatch p={p} />
          <h3 className="grow">{original ? 'Editar marcador' : 'Novo marcador de quantitativo'}</h3>
        </div>

        <div className="sinapi-search">
          <Search size={14} />
          <input placeholder={base ? `Buscar na base: ${base.label} (código ou descrição)` : 'Importe a base SINAPI em Medir → Base de preços para buscar aqui'} value={q} disabled={!base} onChange={(e) => setQ(e.target.value)} />
          {base && <span className="muted small">{base.items.length.toLocaleString('pt-BR')} itens</span>}
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
          <F label="Nome" wide><input ref={nameRef} autoFocus value={p.name} placeholder="ex.: Porcelanato 60×60 retificado" onChange={(e) => up({ name: e.target.value })} /></F>
          <F label="Grupo / disciplina">
            <input value={p.group} list="preset-groups" onChange={(e) => up({ group: e.target.value })} />
            <datalist id="preset-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </F>
          <F label="Código (SINAPI, próprio…)"><input value={p.code} onChange={(e) => up({ code: e.target.value })} /></F>
          <F label="Tipo de medida">
            <select value={p.measure} onChange={(e) => { const m = e.target.value as Preset['measure']; up({ measure: m, resultUnit: p.resultUnit === UNIT[p.measure] ? UNIT[m] : p.resultUnit }) }}>
              <option value="area">Área</option><option value="length">Comprimento</option><option value="count">Contagem</option>
            </select>
          </F>
          <F label="Cor"><input type="color" value={p.color} onChange={(e) => up({ color: e.target.value })} /></F>
          {p.measure !== 'count' ? (
            <>
              <F label="Espessura do traço"><input type="number" min={0.25} step={0.25} value={p.width} onChange={(e) => up({ width: Number(e.target.value) })} /></F>
              <F label="Estilo do traço">
                <select value={p.dash} onChange={(e) => up({ dash: e.target.value as Preset['dash'] })}>
                  <option value="solid">Contínuo</option><option value="dash">Tracejado</option><option value="dot">Pontilhado</option>
                </select>
              </F>
            </>
          ) : (
            <>
              <F label="Símbolo">
                <select value={p.symbol} onChange={(e) => up({ symbol: e.target.value as Preset['symbol'] })}>
                  <option value="circle">Círculo</option><option value="square">Quadrado</option><option value="triangle">Triângulo</option><option value="diamond">Losango</option><option value="cross">Xis</option><option value="letter">Letra</option>
                </select>
              </F>
              <F label="Letra"><input maxLength={2} value={p.letter} onChange={(e) => up({ letter: e.target.value.toUpperCase() })} /></F>
            </>
          )}
          {p.measure === 'area' && (
            <>
              <F label="Hachura">
                <select value={p.pattern} onChange={(e) => up({ pattern: e.target.value as Preset['pattern'] })}>
                  <option value="solid">Sólida</option><option value="hatch">Diagonal</option><option value="cross">Xadrez</option><option value="dots">Pontos</option><option value="none">Sem preenchimento</option>
                </select>
              </F>
              <F label={`Opacidade ${Math.round(p.opacity * 100)}%`}><input type="range" min={0} max={0.9} step={0.05} value={p.opacity} onChange={(e) => up({ opacity: Number(e.target.value) })} /></F>
            </>
          )}
          <F label="Fator H"><input type="number" step={0.01} value={p.factor} onChange={(e) => up({ factor: Number(e.target.value) })} /></F>
          <F label="O que é o fator"><input value={p.factorLabel} placeholder="ex.: pé-direito (m)" onChange={(e) => up({ factorLabel: e.target.value })} /></F>
          <F label="Fórmula (opcional)" wide>
            <input className={err ? 'invalid' : ''} value={p.formula} placeholder={p.measure === 'area' ? 'ex.: A + P*H   (A área, P perímetro, H fator)' : p.measure === 'length' ? 'ex.: L * 1,05' : 'ex.: ceil(N/10)'} onChange={(e) => up({ formula: e.target.value })} />
          </F>
          <div className="hint span2">{err ? <span className="warn">{err}</span> : <>Variáveis: <b>L</b> comprimento · <b>A</b> área · <b>P</b> perímetro · <b>N</b> contagem · <b>H</b> fator. Vazio = medida × H.</>}</div>
          <F label="Unidade final"><input value={p.resultUnit} onChange={(e) => up({ resultUnit: e.target.value })} /></F>
          <F label="Preço unitário (R$)"><input type="number" step={0.01} value={p.unitPrice} onChange={(e) => up({ unitPrice: Number(e.target.value) })} /></F>
          <label className="check span2"><input type="checkbox" checked={p.showLabel} onChange={(e) => up({ showLabel: e.target.checked })} /> Mostrar o valor medido na prancha</label>
        </div>

        <div className="modal-actions">
          {!base && <span className="muted small grow"><Database size={12} /> Sem base de preços importada</span>}
          <button className="btn ghost" onClick={close}>Cancelar</button>
          <button className="btn primary" disabled={!p.name.trim() || !!err} onClick={save}>{original ? 'Salvar' : 'Criar marcador'}</button>
        </div>
      </div>
    </div>
  )
}
