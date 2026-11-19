import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { curSheet, useStore } from '../../store'
import type { State } from '../../store'
import type { Markup, Pt, Sheet, Tool } from '../../types'
import { DEFAULT_SOLID_HEIGHT, fmt, measureOf, polyArea, scaleFor } from '../../geometry'
import type { Qty } from '../../geometry'
import { fmtQty, lenIn, lenOut, lenUnit, unitName } from '../../units'
import { spaceOf } from '../../columns'
import { KIND_LABEL, priorityLabel } from '../../kinds'
import { isIssue, issueList } from '../../issues'
import { duplicateMarkups } from '../../viewerActions'
import { setModeAnimated } from '../../motion'
import { localeOf, t, tp } from '../../i18n'
import { Glyph, Icon } from '../Icon'
import { SelectCb } from './SelectCb'
import { Sample } from './Sample'
import { PalHeader } from './PalFrame'
import { selectMarkup } from './select'
import { KIND_ICON, formatOf, iconOf, isMeasureKind, markupName, markupNames, valueOf } from './model'
import type { ValueText } from './model'
import { Cat, Row, ShutProvider } from './propsUi'
import { HintCtx } from './hintCtx'
import type { Hint } from './hintCtx'

const ClaudePanel = lazy(() => import('../ClaudePanel').then((m) => ({ default: m.ClaudePanel })))

/** Ferramentas de medição: com uma delas ativa e nada selecionado, a paleta mostra o estado "em desenho". */
const DRAW_TOOLS: Tool[] = ['length', 'area', 'count', 'hole', 'space', 'solid', 'fill', 'symbol']
const r3 = (x: number) => Math.round(x * 1000) / 1000

const TOOL_NAME: Partial<Record<Tool, () => string>> = {
  length: () => KIND_LABEL.length, area: () => KIND_LABEL.area, count: () => KIND_LABEL.count, space: () => KIND_LABEL.space, solid: () => KIND_LABEL.solid,
  hole: () => t('ribbon.vazio'), fill: () => t('railtools.area_por_clique'), symbol: () => t('railtools.contagem_automatica'),
}

export function PropsPalette() {
  const tab = useStore((s) => s.rightTab)
  const claude = tab === 'claude'
  const set = useStore((s) => s.set)
  const [hint, setHint] = useState<Hint | null>(null)
  const selKey = useStore((s) => s.selected.join(','))
  useEffect(() => setHint(null), [selKey, claude])
  return (
    <aside className="pal-col right" aria-label={claude ? 'Claude' : t('rightpanel.propriedades')}>
      <div className="rx">
        <PalHeader title={claude ? 'Claude' : t('rightpanel.propriedades')} onClose={() => set({ panels: { ...useStore.getState().panels, right: false } })} />
      </div>
      {claude ? (
        <div className="claude-host">
          <Suspense fallback={<div className="loading-mod">{t('rightpanel.carregando')}</div>}><ClaudePanel /></Suspense>
        </div>
      ) : (
        <HintCtx.Provider value={setHint}>
          <ShutProvider><PropsBody hint={hint} /></ShutProvider>
        </HintCtx.Provider>
      )}
      <div className="rx">
        <div className="ptabs" role="tablist" aria-label={t('pal.paletas_a_direita')}>
          <button type="button" role="tab" aria-selected={!claude} className={claude ? '' : 'on'} onClick={() => set({ rightTab: 'props' })}>{t('rightpanel.propriedades')}</button>
          <button type="button" role="tab" aria-selected={claude} className={`cl${claude ? ' on' : ''}`} onClick={() => set({ rightTab: 'claude' })}><Icon name="claude" size={16} />Claude</button>
        </div>
      </div>
    </aside>
  )
}

function PropsBody({ hint }: { hint: Hint | null }) {
  const s = useStore()
  const sheet = curSheet(s)
  const sel = s.markups.filter((m) => s.selected.includes(m.id))
  const drawing = sel.length === 0 && DRAW_TOOLS.includes(s.tool)
  let body: ReactNode
  let dflt: Hint
  if (sel.length > 1) {
    body = <MultiState sel={sel} />
    dflt = { title: t('pal.n_marcacoes_selecionadas', { n: sel.length }), text: '' }
  } else if (sel.length === 1) {
    const one = single(sel[0], s)
    body = one.body
    dflt = one.hint
  } else if (drawing) {
    body = <DrawingState s={s} sheet={sheet} />
    dflt = { title: TOOL_NAME[s.tool]?.() ?? '', text: t('pal.em_desenho_ajuda') }
  } else {
    body = <SheetState s={s} sheet={sheet} />
    dflt = { title: t('rightpanel.folha'), text: t('pal.ajuda_folha') }
  }
  const h = hint ?? dflt
  return (
    <div className="rx pr2 props-wrap">
      <div className="props-scroll">{body}</div>
      <div className="ds fx" aria-live="polite"><b>{h.title}</b>{h.text && <span>{h.text}</span>}</div>
    </div>
  )
}

/* ---------------------------------------------------------------- campos */
const Txt = ({ v, on, ph, label }: { v: string; on: (v: string) => void; ph?: string; label: string }) => (
  <input className="in" value={v} placeholder={ph} aria-label={label} onChange={(e) => on(e.target.value)} />
)
const Area = ({ v, on, ph, label, small }: { v: string; on: (v: string) => void; ph?: string; label: string; small?: boolean }) => (
  <textarea className={`in ${small ? 'sm' : 'ml'}`} rows={small ? 1 : 2} value={v} placeholder={ph} aria-label={label} onChange={(e) => on(e.target.value)} />
)
const Num = ({ v, on, label, min, max, step }: { v: number; on: (v: number) => void; label: string; min?: number; max?: number; step?: number }) => (
  <input className="in" type="number" value={v} min={min} max={max} step={step} aria-label={label} onChange={(e) => on(Number(e.target.value))} />
)
const Color = ({ v, on, label }: { v: string; on: (v: string) => void; label: string }) => (
  <input className="in" type="color" value={v} aria-label={label} onChange={(e) => on(e.target.value)} />
)

function StatusRow({ value, onPick, label }: { value: string; onPick: (v: string) => void; label?: string }) {
  const statuses = useStore((s) => s.statuses)
  const def = statuses.find((x) => x.name === value)
  return (
    <Row k={t('rightpanel.status')} ed hint={t('pal.ajuda_status')}>
      <SelectCb value={value} label={t('rightpanel.status')} current={label ?? value} lead={<i className="cz" style={{ background: def?.color ?? 'transparent' }} />} onChange={(v) => (v === '__manage' ? useStore.getState().set({ dialog: 'statuses' }) : onPick(v))}>
        {statuses.map((x) => <option key={x.name}>{x.name}</option>)}
        {!def && value && <option>{value}</option>}
        <option value="__manage">{t('rightpanel.gerenciar_status')}</option>
      </SelectCb>
    </Row>
  )
}

function SheetLevelRow({ sheet }: { sheet: Sheet }) {
  const sheets = useStore((s) => s.sheets)
  const levels = Array.from(new Set(sheets.map((x) => x.level).filter(Boolean))) as string[]
  return (
    <Row k={t('pal.pavimento')} ed hint={t('pal.ajuda_pavimento')}>
      <input className="in" data-focus="pavimento" list="pal-levels" value={sheet.level ?? ''} placeholder={t('leftpanel.ex_terreo_1_pavimento')} aria-label={t('leftpanel.pavimento_desta_folha')} onChange={(e) => useStore.setState({ sheets: useStore.getState().sheets.map((x) => (x.id === sheet.id ? { ...x, level: e.target.value } : x)) })} />
      <datalist id="pal-levels">{levels.map((l) => <option key={l} value={l} />)}</datalist>
    </Row>
  )
}

/* ---------------------------------------------------------------- cabeçalho (seletor, resumo, ações) */
function Head({ selector, icon, name, state, value }: { selector: ReactNode; icon: string; name: string; state?: string; value?: ValueText | null }) {
  return (
    <div className="oh">
      {selector}
      <div className="ol">
        <span><Icon name={icon} size={16} /><b>{name}</b>{state && <> · {state}</>}</span>
        {value && (value.ok ? <span className="ov2"><b className="n">{value.text}</b> {value.unit}</span> : <span className="mut">{t('pal.sem_escala')}</span>)}
      </div>
    </div>
  )
}
const Static = ({ icon, label }: { icon: string; label: string }) => <div className="cb ot" aria-label={label}><Icon name={icon} size={16} /><span>{label}</span></div>

function Actions({ ids, kind }: { ids: string[]; kind?: Markup['kind'] }) {
  const mode = useStore((s) => s.mode)
  const solid3d = kind === 'solid' && mode === '3d'
  const del = () => useStore.getState().removeMarkups(ids)
  if (solid3d) {
    return (
      <div className="pbar ac eq" role="toolbar" aria-label={t('pal.acoes_da_selecao')}>
        <button type="button" className="tbn txt" title={t('view3d.ver_na_planta')} onClick={() => goPlan(ids[0])}>{t('view3d.ver_na_planta')}</button>
        <button type="button" className="tbn txt" title={t('rightpanel.duplicar')} onClick={() => duplicateMarkups(ids)}>{t('rightpanel.duplicar')}</button>
        <button type="button" className="tbn txt" title={`${t('rightpanel.excluir')} (Del)`} onClick={del}>{t('rightpanel.excluir')} <kbd>(Del)</kbd></button>
      </div>
    )
  }
  return (
    <div className="pbar ac" role="toolbar" aria-label={t('pal.acoes_da_selecao')}>
      <button type="button" className="tbn" title={t('rightpanel.duplicar')} onClick={() => duplicateMarkups(ids)}><Icon name={iconOf('duplicate')} size={16} />{t('rightpanel.duplicar')}</button>
      <button type="button" className="tbn" title={`${t('rightpanel.excluir')} (Del)`} onClick={del}><Icon name={iconOf('delete')} size={16} />{t('rightpanel.excluir')} <kbd>(Del)</kbd></button>
    </div>
  )
}

function goPlan(id: string) {
  const s = useStore.getState()
  const m = s.markups.find((x) => x.id === id)
  setModeAnimated('review', { tool: 'select', selected: [id], ...(m ? { page: Math.max(0, s.sheets.findIndex((x) => x.id === m.page)) } : {}) })
}

/* ---------------------------------------------------------------- sem seleção: a folha */
function SheetState({ s, sheet }: { s: State; sheet: Sheet | undefined }) {
  const names = useMemo(() => markupNames(s.markups), [s.markups])
  if (!sheet) {
    return (
      <>
        <div className="oh"><Static icon="folhaIco" label={t('rightpanel.folha')} /></div>
        <p className="pvz">{t('pal.sem_documento')}</p>
      </>
    )
  }
  const sc = s.scales[sheet.id]
  const mine = s.markups.filter((m) => m.page === sheet.id)
  const marks = mine.filter((m) => m.kind !== 'viewport')
  const vps = mine.length - marks.length
  const fm = formatOf(sheet)
  const i = s.sheets.findIndex((x) => x.id === sheet.id)
  const pick = (id: string) => { const m = s.markups.find((x) => x.id === id); if (m) selectMarkup(m) }
  return (
    <>
      <div className="oh">
        <SelectCb className="ot" value="" label={t('pal.objeto_mostrado')} current={t('rightpanel.folha')} lead={<Icon name="folhaIco" size={16} />} onChange={pick}>
          <option value="">{t('rightpanel.folha')}</option>
          {marks.map((m) => <option key={m.id} value={m.id}>{names.get(m.id)}</option>)}
        </SelectCb>
        <div className="ol">
          <span><Icon name="folhaIco" size={16} /><b>{String(i + 1).padStart(2, '0')} · {sheet.label}</b></span>
          <span className="mut">{tp('pal.n_marcacoes', marks.length)}</span>
        </div>
      </div>
      <div className="pg" role="table" aria-label={t('pal.propriedades_da_folha')}>
        <Cat id="escala" title={t('rightpanel.escala')} action={<button type="button" className="tbn txt" onClick={() => s.set({ calibrating: { page: sheet.id, length: 0 } })}>{t('rightpanel.definir_escala')}</button>}>
          <Row k={t('pal.escala_da_folha')} hint={t('pal.ajuda_escala_folha')}><b className="n">{sc ? sc.label : '—'}</b></Row>
          <Row k={t('rightpanel.viewports')}><span className="n">{vps}</span></Row>
        </Cat>
        <Cat id="folha" title={t('rightpanel.folha')}>
          <Row k={t('rightpanel.folha')}>{sheet.label}</Row>
          <Row k={t('pal.numero')}><span className="n">{String(i + 1).padStart(2, '0')}</span> <span className="mut">{t('pal.de_n', { n: s.sheets.length })}</span></Row>
          <SheetLevelRow sheet={sheet} />
          <Row k={t('pal.formato')}>{fm.name} <span className="mut">{fm.dims}</span></Row>
          <Row k={t('rightpanel.marcacoes')}><span className="n">{marks.length}</span></Row>
        </Cat>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- em desenho */
function DrawingState({ s, sheet }: { s: State; sheet: Sheet | undefined }) {
  const name = TOOL_NAME[s.tool]?.() ?? ''
  const measure = s.tool === 'fill' ? 'area' : s.tool === 'symbol' ? 'count' : s.tool
  const list = s.presets.filter((p) => p.measure === measure)
  const active = s.presets.find((p) => p.id === s.activePreset)
  const sc = sheet ? s.scales[sheet.id] : undefined
  const icon = s.tool === 'fill' || s.tool === 'symbol' || s.tool === 'hole' ? iconOf(s.tool) : KIND_ICON[s.tool as Markup['kind']] ?? iconOf('select')
  const selector = list.length && ['length', 'area', 'count', 'fill', 'symbol'].includes(s.tool)
    ? (
      <SelectCb className="ot" value={active?.id ?? ''} label={t('pal.marcador_em_uso')} current={active?.name ?? t('rightpanel.sem_marcador')} lead={active ? <Sample p={active} /> : undefined} onChange={(v) => s.set({ activePreset: v || null })}>
        <option value="">{t('rightpanel.sem_marcador')}</option>
        {list.map((p) => <option key={p.id} value={p.id}>{p.group} · {p.name}</option>)}
      </SelectCb>
    )
    : <Static icon={icon} label={name} />
  return (
    <>
      <Head selector={selector} icon={icon} name={name} state={t('pal.em_desenho')} />
      <div className="pg" role="table" aria-label={t('pal.medicao_em_andamento')}>
        <Cat id="andamento" title={t('pal.medicao_em_andamento')}>
          <Row k={t('pal.ferramenta')}>{name}</Row>
          <Row k={t('pal.marcador')}>{active?.name ?? <span className="mut">{t('rightpanel.sem_marcador')}</span>}</Row>
          <Row k={t('pal.escala_da_folha')}>{sc ? <b className="n">{sc.label}</b> : <span className="mut">{t('pal.sem_escala')}</span>}</Row>
        </Cat>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- várias marcações */
function MultiState({ sel }: { sel: Markup[] }) {
  const s = useStore.getState()
  const ids = sel.map((m) => m.id)
  return (
    <>
      <div className="oh">
        <Static icon={iconOf('select')} label={t('pal.n_marcacoes_selecionadas', { n: sel.length })} />
        <div className="ol"><span><Icon name={iconOf('select')} size={16} /><b>{t('pal.n_marcacoes_selecionadas', { n: sel.length })}</b></span></div>
      </div>
      <Actions ids={ids} />
      <div className="pg" role="table" aria-label={t('pal.propriedades_da_selecao')}>
        <Cat id="ident" title={t('pal.identificacao')}>
          <StatusRow value="" label={t('rightpanel.alterar_status')} onPick={(v) => s.setStatus(ids, v)} />
        </Cat>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- uma marcação */
function single(m: Markup, s: State): { body: ReactNode; hint: Hint } {
  const preset = s.presets.find((p) => p.id === m.presetId)
  const q = measureOf(m, scaleFor(m, s.markups, s.scales[m.page]), preset)
  const val = valueOf(m, s.markups, s.scales, s.presets)
  const name = markupName(m, s.markups)
  const dflt: Hint = {
    title: name,
    text: m.kind === 'solid' ? t('view3d.arraste_a_seta_laranja_para') : m.kind === 'viewport' ? t('rightpanel.medicoes_que_comecam_dentro_deste') : m.kind === 'space' ? t('rightpanel.medicoes_cujo_centro_cai_dentro') : m.kind === 'redact' ? t('rightpanel.o_conteudo_sob_a_tarja') : '',
  }
  return { body: <SingleBody m={m} s={s} q={q} val={val} name={name} />, hint: dflt }
}

function SingleBody({ m, s, q, val, name }: { m: Markup; s: State; q: Qty | null; val: ValueText | null; name: string }) {
  const preset = s.presets.find((p) => p.id === m.presetId)
  const sheet = s.sheets.find((x) => x.id === m.page)
  const sheetIdx = s.sheets.findIndex((x) => x.id === m.page)
  const measure = isMeasureKind(m.kind)
  const up = (patch: Partial<Markup>) => s.updateMarkup(m.id, patch)
  const upq = (patch: Partial<Markup>) => s.updateMarkup(m.id, patch, false)
  const space = measure ? spaceOf(m, s.markups) : undefined
  const sc = scaleFor(m, s.markups, s.scales[m.page])
  const icon = KIND_ICON[m.kind]
  const k = m.kind

  const selector = measure ? (
    <SelectCb className="ot" value={m.presetId ?? ''} label={t('rightpanel.marcador_de_quantitativo')} current={preset?.name ?? t('rightpanel.sem_marcador')} lead={preset ? <Sample p={preset} /> : undefined}
      onChange={(v) => { const p = s.presets.find((x) => x.id === v); up(p ? { presetId: p.id, color: p.color, fill: p.color, width: p.width, fillOpacity: p.opacity } : { presetId: null }) }}>
      <option value="">{t('rightpanel.sem_marcador')}</option>
      {s.presets.filter((p) => p.measure === k).map((p) => <option key={p.id} value={p.id}>{p.group} · {p.name}</option>)}
    </SelectCb>
  ) : <Static icon={icon} label={KIND_LABEL[k]} />

  const holes = (k === 'area' || k === 'space' || k === 'solid') ? (
    <>
      <Row k={t('pal.vazios_v')} hint={t('pal.ajuda_vazios')}><span className="n">{m.holes?.length ?? 0}</span>{q && q.vars.V > 0 && <span className="mut">{t('pal.descontado', { v: fmtQty(q.vars.V, 'm²') })}</span>}</Row>
      {(m.holes ?? []).map((h: Pt[], i: number) => {
        const a = sc ? polyArea(h) * sc.metersPerUnit * sc.metersPerUnit : null
        return (
          <Row key={i} k={t('rightpanel.vazio', { v: i + 1 })} sub>
            <span className="n">{a != null ? fmtQty(a, 'm²') : '—'}</span>
            <button type="button" className="tbn txt" title={t('rightpanel.remover_vazio')} onClick={() => up({ holes: m.holes!.filter((_, j) => j !== i) })}>{t('rightpanel.remover')}</button>
          </Row>
        )
      })}
      <Row k="" sub wr>
        <button type="button" className="tbn" onClick={() => s.set({ tool: 'hole', holeTarget: m.id })}><Icon name="vazio" size={16} />{t('rightpanel.desenhar_vazio')}</button>
        <button type="button" className="tbn txt" title={t('rightpanel.shift_clique_dentro_do_vazio')} onClick={() => s.set({ tool: 'fill', fillAs: k === 'space' ? 'space' : 'area', holeTarget: m.id })}>{t('rightpanel.por_clique')}</button>
      </Row>
    </>
  ) : null

  const showAppearance = !preset && !['stamp', 'image', 'viewport', 'redact'].includes(k)
  const custom = measure ? s.columns.filter((c) => c.type !== 'formula') : []
  const issue = isIssue(m)

  return (
    <>
      <Head selector={selector} icon={icon} name={name} state={t('pal.selecionada')} value={val} />
      <Actions ids={[m.id]} kind={k} />
      <div className="pg" role="table" aria-label={t('pal.propriedades_de', { nome: name })}>
        {k === 'solid' && (
          <Cat id="solido" title={t('kinds.solido_3d')}>
            <Row k={t('pal.nome')} ed><Txt v={m.text} on={(v) => upq({ text: v })} label={t('rightpanel.nome_do_solido')} /></Row>
            <Row k={t('rightpanel.base_m', { u: lenUnit() })} ed><Num v={r3(lenIn(m.base ?? 0))} step={0.05} on={(v) => up({ base: lenOut(v) })} label={t('rightpanel.base_m', { u: lenUnit() })} /></Row>
            <Row k={t('rightpanel.altura_m', { u: lenUnit() })} ed hint={t('view3d.arraste_a_seta_laranja_para')}><Num v={r3(lenIn(m.height ?? DEFAULT_SOLID_HEIGHT))} min={r3(lenIn(0.05))} step={r3(lenIn(0.05))} on={(v) => { const h = Math.max(0.05, lenOut(v)); up({ height: h }); s.rememberSolid({ height: h }) }} label={t('rightpanel.altura_m', { u: lenUnit() })} /></Row>
            <Row k={t('rightpanel.cor')} ed><Color v={m.color} on={(v) => { up({ color: v, fill: v }); s.rememberSolid({ color: v }) }} label={t('rightpanel.cor')} /></Row>
          </Cat>
        )}
        {(k === 'length' || k === 'area' || k === 'space' || k === 'solid') && (
          <Cat id="medicao" title={t('pal.medicao')}>
            {!q && <Row k={t('rightpanel.escala')}><span className="mut">{t('rightpanel.defina_a_escala_da_folha')}</span></Row>}
            {q?.error && <Row k={t('pal.formula')} wr><span className="mut">{q.error}</span></Row>}
            {q && k === 'length' && <Row k={t('pal.comprimento_l')}><b className="n">{fmtQty(q.vars.L, 'm')}</b></Row>}
            {q && (k === 'area' || k === 'space') && <Row k={t('pal.perimetro_p')} hint={t('pal.ajuda_perimetro')}><b className="n">{fmtQty(q.vars.P, 'm')}</b></Row>}
            {q && (k === 'area' || k === 'space') && (preset?.formula || (preset && preset.factor !== 1) || q.unit !== 'm²') && <Row k={t('pal.area_a')}><b className="n">{fmtQty(q.vars.A, 'm²')}</b></Row>}
            {q && k === 'solid' && <Row k={t('rightpanel.area_da_base')}><b className="n">{fmtQty(q.vars.A, 'm²')}</b></Row>}
            {q && k === 'solid' && <Row k={t('rightpanel.area_lateral')}><b className="n">{fmtQty(q.vars.AL, 'm²')}</b></Row>}
            {q && k === 'solid' && <Row k={t('rightpanel.topo_na_cota')}><b className="n">{fmtQty((m.base ?? 0) + (m.height ?? DEFAULT_SOLID_HEIGHT), 'm')}</b></Row>}
            {holes}
            {(k === 'length' || k === 'area') && (
              <Row k={t('pal.deducao')} ed hint={t('pal.ajuda_deducao')}>
                <label className="chkrow"><input type="checkbox" checked={m.deduct} onChange={(e) => up({ deduct: e.target.checked })} />{t('pal.vao_desconto')}</label>
              </Row>
            )}
            {k !== 'solid' && <Row k={t('rightpanel.escala')} hint={t('pal.ajuda_escala_medicao')}>{sc ? <><b className="n">{(m.scale ?? s.scales[m.page])?.label ?? '—'}</b> <span className="mut">{m.scale ? t('pal.do_viewport') : t('pal.da_folha')}</span></> : '—'}</Row>}
            {k !== 'solid' && <Row k={t('pal.vertices')}><span className="n">{m.points.length}</span></Row>}
          </Cat>
        )}
        {k === 'viewport' && (
          <Cat id="viewport" title={t('kinds.viewport')} action={<button type="button" className="tbn txt" onClick={() => s.set({ calibrating: { page: m.page, length: 0, viewport: m.id } })}>{t('rightpanel.definir_escala')}</button>}>
            <Row k={t('pal.nome')} ed><Txt v={m.text} on={(v) => upq({ text: v })} label={t('rightpanel.nome_do_viewport')} /></Row>
            <Row k={t('rightpanel.escala')}><b className="n">{m.scale?.label ?? '—'}</b></Row>
          </Cat>
        )}
        {k === 'text' && (
          <Cat id="texto" title={t('rightpanel.texto')}>
            <Row k={t('rightpanel.texto')} ed wr><Area v={m.text} on={(v) => upq({ text: v })} label={t('rightpanel.texto')} /></Row>
            <Row k={t('pal.tamanho')} ed><Num v={m.fontSize} min={6} max={72} on={(v) => up({ fontSize: v })} label={t('rightpanel.tamanho_da_fonte')} /></Row>
          </Cat>
        )}
        {k === 'stamp' && (
          <Cat id="carimbo" title={t('kinds.carimbo')}>
            <Row k={t('rightpanel.texto')} ed wr hint={t('rightpanel.texto_variaveis', { data: '{data}', hora: '{hora}', folha: '{folha}', n: '{n}', total: '{total}', autor: '{autor}', arquivo: '{arquivo}' })}><Area v={m.text} on={(v) => upq({ text: v })} label={t('rightpanel.texto')} /></Row>
            <Row k={t('rightpanel.cor')} ed><Color v={m.color} on={(v) => up({ color: v })} label={t('rightpanel.cor')} /></Row>
            <Row k={t('rightpanel.fonte')} ed><Num v={m.fontSize} min={6} max={200} on={(v) => up({ fontSize: v })} label={t('rightpanel.fonte')} /></Row>
            <Row k={t('rightpanel.borda')} ed><Num v={m.width} min={0} step={0.5} on={(v) => up({ width: v })} label={t('rightpanel.borda')} /></Row>
            <Row k={t('pal.rotacao')} ed><Num v={m.angle ?? 0} min={-90} max={90} step={5} on={(v) => up({ angle: v })} label={t('pal.rotacao')} /><span className="mut">°</span></Row>
            <Row k={t('pal.opacidade')} ed><Num v={Math.round((m.opacity ?? 1) * 100)} min={5} max={100} step={5} on={(v) => up({ opacity: v / 100 })} label={t('pal.opacidade')} /><span className="mut">%</span></Row>
          </Cat>
        )}
        {k === 'redact' && (
          <Cat id="tarja" title={t('kinds.tarja_correcao')}>
            <Row k={t('pal.tipo')} ed>
              <SelectCb value={m.fill} label={t('pal.tipo')} current={m.fill === '#ffffff' ? t('rightpanel.apagar_branco') : t('rightpanel.tarja_preta')} onChange={(v) => up({ fill: v })}>
                <option value="#000000">{t('rightpanel.tarja_preta')}</option>
                <option value="#ffffff">{t('rightpanel.apagar_branco')}</option>
              </SelectCb>
            </Row>
            <Row k={t('pal.substituicao')} ed wr hint={t('rightpanel.texto_de_substituicao_opcional_corrige')}><Area v={m.text} on={(v) => upq({ text: v })} label={t('rightpanel.texto_de_substituicao_opcional_corrige')} /></Row>
            <Row k={t('pal.tamanho')} ed><Num v={m.fontSize} min={4} max={72} on={(v) => up({ fontSize: v })} label={t('rightpanel.tamanho_da_fonte')} /></Row>
          </Cat>
        )}
        {k === 'image' && (
          <Cat id="imagem" title={t('kinds.imagem')}>
            <Row k={t('pal.opacidade')} ed><Num v={Math.round((m.opacity ?? 1) * 100)} min={5} max={100} step={5} on={(v) => up({ opacity: v / 100 })} label={t('pal.opacidade')} /><span className="mut">%</span></Row>
          </Cat>
        )}
        {k === 'space' && (
          <Cat id="ambiente" title={t('kinds.ambiente')}>
            <Row k={t('pal.nome')} ed><Txt v={m.text} on={(v) => upq({ text: v })} label={t('rightpanel.nome_do_ambiente')} /></Row>
            <Row k={t('rightpanel.cor')} ed><Color v={m.color} on={(v) => up({ color: v, fill: v })} label={t('rightpanel.cor')} /></Row>
          </Cat>
        )}

        <Cat id="ident" title={t('pal.identificacao')}>
          <Row k={t('pal.tipo')}>{KIND_LABEL[k]}</Row>
          <Row k={t('rightpanel.folha')}><span className="n">{String(sheetIdx + 1).padStart(2, '0')}</span> · {sheet?.label}</Row>
          {measure && <Row k={t('pal.ambiente')}>{space?.text || <span className="mut">{t('pal.fora_de_ambiente')}</span>}</Row>}
          {sheet && (k === 'area' || k === 'space') && <SheetLevelRow sheet={sheet} />}
          <StatusRow value={m.status} onPick={(v) => up({ status: v })} />
          <Row k={t('rightpanel.comentario')} ed><Area small v={m.comment} on={(v) => upq({ comment: v })} ph={t('rightpanel.observacao_ambiente_responsavel')} label={t('rightpanel.comentario')} /></Row>
          <Row k={t('pal.autor')}>{m.author}</Row>
          <Row k={t('pal.criada_em')}>{new Date(m.createdAt).toLocaleString(localeOf())}</Row>
        </Cat>

        {measure && (
          <Cat id="quant" title={t('bottompanel.quantitativo')}>
            {preset ? (
              <>
                <Row k={t('bottompanel.grupo')}>{preset.group}</Row>
                <Row k={t('bottompanel.codigo')}>{preset.code || <span className="mut">—</span>}</Row>
                <Row k={t('pal.formula')} hint={t('pal.ajuda_formula')}>{preset.formula || (preset.factor !== 1 ? `× ${fmt(preset.factor)}${preset.factorLabel ? ' · ' + preset.factorLabel : ''}` : <span className="mut">—</span>)}</Row>
                <Row k={t('presetdialog.unidade_final')}><b>{unitName(preset.resultUnit)}</b></Row>
                <Row k={t('pal.preco_unitario')}>{preset.unitPrice ? <><span className="mut">R$</span> <span className="n">{fmt(preset.unitPrice)}</span></> : <span className="mut">—</span>}</Row>
              </>
            ) : <Row k={t('pal.marcador')}><span className="mut">{t('rightpanel.sem_marcador')}</span></Row>}
            {custom.map((c) => (
              <Row key={c.id} k={c.name} ed><input className="in" type={c.type === 'number' ? 'number' : 'text'} aria-label={c.name} value={m.fields?.[c.id] ?? ''} onChange={(e) => upq({ fields: { ...m.fields, [c.id]: c.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value } })} /></Row>
            ))}
          </Cat>
        )}

        {measure && preset && (
          <Cat id="aparencia" title={t('pal.aparencia_do_marcador')} action={<button type="button" className="tbn txt" onClick={() => s.set({ presetDialog: { id: preset.id } })}>{t('pal.editar_reticencias')}</button>}>
            <Row k={t('rightpanel.cor')}><i className="cz" style={{ background: preset.color }} /><span className="n">{preset.color.toUpperCase()}</span></Row>
            {preset.measure === 'area' && <Row k={t('presetdialog.hachura')}>{{ solid: t('presetdialog.solida'), hatch: t('presetdialog.diagonal'), cross: t('presetdialog.xadrez'), dots: t('presetdialog.pontos'), none: t('presetdialog.sem_preenchimento') }[preset.pattern]}</Row>}
            {preset.measure === 'area' && <Row k={t('pal.opacidade')}><span className="n">{Math.round(preset.opacity * 100)}</span> %</Row>}
            <Row k={t('pal.rotulo')}><span className="ck" aria-hidden="true">{preset.showLabel && <Glyph name="check" size={10} />}</span><span>{t('pal.valor_na_prancha')}</span></Row>
          </Cat>
        )}
        {showAppearance && (
          <Cat id="aparencia" title={t('pal.aparencia')}>
            {k !== 'solid' && k !== 'space' && <Row k={t('rightpanel.cor')} ed><Color v={m.color} on={(v) => up({ color: v, fill: v })} label={t('rightpanel.cor')} /></Row>}
            <Row k={t('rightpanel.espessura')} ed><Num v={m.width} min={0.25} step={0.25} on={(v) => up({ width: v })} label={t('rightpanel.espessura')} /></Row>
            {k !== 'text' && k !== 'count' && k !== 'line' && k !== 'arrow' && k !== 'length' && (
              <Row k={t('rightpanel.preench')} ed><Num v={Math.round(m.fillOpacity * 100)} min={0} max={80} step={5} on={(v) => up({ fillOpacity: v / 100 })} label={t('rightpanel.preench')} /><span className="mut">%</span></Row>
            )}
          </Cat>
        )}

        {issue && <IssueCat m={m} />}
        {issue && <RepliesCat m={m} />}
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- compatibilização */
function IssueCat({ m }: { m: Markup }) {
  const s = useStore.getState()
  const no = issueList(s.markups).find((x) => x.m.id === m.id)?.no
  const people = Array.from(new Set(s.markups.map((x) => x.assignee).filter(Boolean))) as string[]
  const upq = (patch: Partial<Markup>) => s.updateMarkup(m.id, patch, false)
  return (
    <Cat id="compat" title={t('pal.compatibilizacao')}>
      <Row k={t('pal.n_item')}><b className="n">{String(m.issueNo ?? no ?? '').padStart(2, '0')}</b></Row>
      <Row k={t('rightpanel.responsavel')} ed>
        <input className="in" list="pal-people" value={m.assignee ?? ''} placeholder={t('rightpanel.ex_eletrica_fulano')} aria-label={t('rightpanel.responsavel')} onChange={(e) => upq({ assignee: e.target.value })} />
        <datalist id="pal-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      </Row>
      <Row k={t('rightpanel.prioridade')} ed>
        <SelectCb value={m.priority ?? ''} label={t('rightpanel.prioridade')} current={m.priority ? priorityLabel(m.priority) : '—'} onChange={(v) => s.updateMarkup(m.id, { priority: (v || undefined) as Markup['priority'] })}>
          <option value="">—</option><option value="alta">{t('rightpanel.alta')}</option><option value="média">{t('rightpanel.media')}</option><option value="baixa">{t('rightpanel.baixa')}</option>
        </SelectCb>
      </Row>
      <Row k={t('rightpanel.prazo')} ed><input className="in" type="date" value={m.due ?? ''} aria-label={t('rightpanel.prazo')} onChange={(e) => s.updateMarkup(m.id, { due: e.target.value || undefined })} /></Row>
      <Row k={t('rightpanel.n_fixo')} ed><input className="in" type="number" min={1} value={m.issueNo ?? ''} placeholder={String(no ?? '')} aria-label={t('rightpanel.n_fixo')} onChange={(e) => upq({ issueNo: e.target.value ? Number(e.target.value) : undefined })} /></Row>
    </Cat>
  )
}

function RepliesCat({ m }: { m: Markup }) {
  const s = useStore.getState()
  const [reply, setReply] = useState('')
  const send = () => {
    if (!reply.trim()) return
    s.updateMarkup(m.id, { replies: [...(m.replies ?? []), { author: s.author, at: Date.now(), text: reply.trim() }] })
    setReply('')
  }
  return (
    <Cat id="respostas" title={t('pal.respostas')} count={m.replies?.length ?? 0}>
      {(m.replies ?? []).map((r, i) => (
        <div key={i} className="rp">
          <div className="rp-h"><b>{r.author}</b><span>{new Date(r.at).toLocaleString(localeOf())}</span>
            <button type="button" className="tbn txt" onClick={() => s.updateMarkup(m.id, { replies: m.replies!.filter((_, j) => j !== i) })}>{t('rightpanel.remover')}</button>
          </div>
          <p>{r.text}</p>
        </div>
      ))}
      <div className="rn">
        <input className="in" value={reply} placeholder={t('rightpanel.responder')} aria-label={t('rightpanel.responder')} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send() } }} />
        <button type="button" className="tbn txt" disabled={!reply.trim()} onClick={send}>{t('pal.adicionar')}</button>
      </div>
    </Cat>
  )
}

