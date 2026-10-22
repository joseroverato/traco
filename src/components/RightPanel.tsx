import { Suspense, lazy, useState } from 'react'
import { ChevronsRight, Copy, Download, Pencil, Plus, RotateCcw, Send, Sparkles, SquareDashed, Trash2, Upload, X } from 'lucide-react'
import { defaultPresets, uid, useStore } from '../store'
import type { Markup, Preset } from '../types'
import { DEFAULT_SOLID_HEIGHT, fmt, measureOf, polyArea, scaleFor } from '../geometry'
import { isIssue, issueList } from '../issues'
import { spaceOf } from '../columns'
import { KIND_LABEL } from '../kinds'
import { localeOf, t } from '../i18n'
import { display, fmtQty, lenIn, lenOut, lenUnit, unitName } from '../units'
import { Rich } from './Rich'
import { TickSlider } from './TickSlider'

const MEASURE_LABEL = { get length() { return t('rightpanel.comprimento') }, get area() { return t('rightpanel.area') }, get count() { return t('rightpanel.contagem') } }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Props() {
  const s = useStore()
  const sel = s.markups.filter((m) => s.selected.includes(m.id))
  if (!sel.length) {
    const sh = s.sheets[s.page]
    const sc = sh ? s.scales[sh.id] : undefined
    return (
      <div className="pad stack">
        <p className="muted">{t('rightpanel.selecione_uma_marcacao_para_editar')}</p>
        {sh && (
          <div className="card">
            <div className="kv"><span>{t('rightpanel.folha')}</span><b>{sh.label}</b></div>
            <div className="kv"><span>{t('rightpanel.escala')}</span><b>{sc ? sc.label : '—'}</b></div>
            <div className="kv"><span>{t('rightpanel.viewports')}</span><b>{s.markups.filter((m) => m.page === sh.id && m.kind === 'viewport').length}</b></div>
            <div className="kv"><span>{t('rightpanel.marcacoes')}</span><b>{s.markups.filter((m) => m.page === sh.id && m.kind !== 'viewport').length}</b></div>
            <button className="btn sm" onClick={() => s.set({ calibrating: { page: sh.id, length: 0 } })}>{t('rightpanel.definir_escala')}</button>
          </div>
        )}
      </div>
    )
  }
  if (sel.length > 1) {
    return (
      <div className="pad stack">
        <p><Rich k="rightpanel.n_selecionadas" vars={{ n: sel.length }} /></p>
        <Field label={t('rightpanel.status')}>
          <select onChange={(e) => s.setStatus(s.selected, e.target.value)} defaultValue="">
            <option value="" disabled>{t('rightpanel.alterar_status')}</option>
            {s.statuses.map((x) => <option key={x.name}>{x.name}</option>)}
          </select>
        </Field>
        <button className="btn danger sm" onClick={() => s.removeMarkups(s.selected)}><Trash2 size={14} /> {t('rightpanel.excluir')}</button>
      </div>
    )
  }
  const m = sel[0]
  const preset = s.presets.find((p) => p.id === m.presetId)
  const isMeasure = m.kind === 'length' || m.kind === 'area' || m.kind === 'count'
  const q = measureOf(m, scaleFor(m, s.markups, s.scales[m.page]), preset)
  const up = (patch: Partial<Markup>) => s.updateMarkup(m.id, patch)
  return (
    <div className="pad stack">
      <div className="prop-title">
        <span className="dot" style={{ background: m.color }} />
        <b>{preset?.name ?? KIND_LABEL[m.kind]}</b>
      </div>
      {isMeasure && (
        <div className="measure-box">
          {q ? (
            <>
              <div className="big">{q.error ? '—' : fmt(display(q.value, q.unit).value)} <small>{display(q.value, q.unit).unit}</small></div>
              {q.error && <div className="warn">{t('rightpanel.formula', { error: q.error })}</div>}
              <div className="vars muted small">
                {m.kind === 'length' && <span>L {fmtQty(q.vars.L, 'm')}</span>}
                {m.kind === 'area' && <><span>A {fmtQty(q.vars.A, 'm²')}</span><span>P {fmtQty(q.vars.P, 'm')}</span>{q.vars.V > 0 && <span>V {fmtQty(q.vars.V, 'm²')}</span>}</>}
                {m.kind === 'count' && <span>N {q.vars.N}</span>}
                {preset && preset.factor !== 1 && <span>H {fmt(preset.factor)}</span>}
                {preset?.formula && <span className="mono">= {preset.formula}</span>}
              </div>
            </>
          ) : (
            <div className="muted">{t('rightpanel.defina_a_escala_da_folha')}</div>
          )}
        </div>
      )}
      {isMeasure && (
        <Field label={t('rightpanel.marcador_de_quantitativo')}>
          <select
            value={m.presetId ?? ''}
            onChange={(e) => {
              const p = s.presets.find((x) => x.id === e.target.value)
              up(p ? { presetId: p.id, color: p.color, fill: p.color, width: p.width, fillOpacity: p.opacity } : { presetId: null })
            }}
          >
            <option value="">{t('rightpanel.sem_marcador')}</option>
            {s.presets.filter((p) => p.measure === m.kind).map((p) => <option key={p.id} value={p.id}>{p.group} · {p.name}</option>)}
          </select>
        </Field>
      )}
      {(m.kind === 'length' || m.kind === 'area') && (
        <label className="check">
          <input type="checkbox" checked={m.deduct} onChange={(e) => up({ deduct: e.target.checked })} />{t('rightpanel.deducao_vao_desconto')}</label>
      )}
      {!preset && !['stamp', 'image', 'viewport', 'redact'].includes(m.kind) && (
        <div className="row">
          <Field label={t('rightpanel.cor')}><input type="color" value={m.color} onChange={(e) => up({ color: e.target.value, fill: e.target.value })} /></Field>
          <Field label={t('rightpanel.espessura')}><input type="number" min={0.25} step={0.25} value={m.width} onChange={(e) => up({ width: Number(e.target.value) })} /></Field>
          {m.kind !== 'text' && m.kind !== 'count' && m.kind !== 'line' && m.kind !== 'arrow' && m.kind !== 'length' && (
            <Field label={t('rightpanel.preench')}><TickSlider min={0} max={0.8} step={0.05} value={m.fillOpacity} onChange={(v) => up({ fillOpacity: v })} /></Field>
          )}
        </div>
      )}
      {m.kind === 'viewport' && (
        <>
          <Field label={t('rightpanel.nome_do_viewport')}><input value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="card">
            <div className="kv"><span>{t('rightpanel.escala')}</span><b>{m.scale?.label ?? '—'}</b></div>
            <button className="btn sm" onClick={() => s.set({ calibrating: { page: m.page, length: 0, viewport: m.id } })}>{t('rightpanel.definir_escala')}</button>
            <span className="muted small">{t('rightpanel.medicoes_que_comecam_dentro_deste')}</span>
          </div>
        </>
      )}
      {m.kind === 'stamp' && (
        <>
          <Field label={t('rightpanel.texto_variaveis')}><textarea rows={3} value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="row">
            <Field label={t('rightpanel.cor')}><input type="color" value={m.color} onChange={(e) => up({ color: e.target.value })} /></Field>
            <Field label={t('rightpanel.fonte')}><input type="number" min={6} max={200} value={m.fontSize} onChange={(e) => up({ fontSize: Number(e.target.value) })} /></Field>
            <Field label={t('rightpanel.borda')}><input type="number" min={0} step={0.5} value={m.width} onChange={(e) => up({ width: Number(e.target.value) })} /></Field>
          </div>
          <div className="row">
            <Field label={t('rightpanel.rotacao', { v: m.angle ?? 0 })}><TickSlider min={-90} max={90} step={5} value={m.angle ?? 0} unit="°" onChange={(v) => up({ angle: v })} /></Field>
            <Field label={t('rightpanel.opacidade', { round: Math.round((m.opacity ?? 1) * 100) })}><TickSlider min={0.05} max={1} step={0.05} value={m.opacity ?? 1} onChange={(v) => up({ opacity: v })} /></Field>
          </div>
        </>
      )}
      {m.kind === 'redact' && (
        <>
          <div className="seg wide">
            <button className={m.fill === '#000000' ? 'active' : ''} onClick={() => up({ fill: '#000000' })}>{t('rightpanel.tarja_preta')}</button>
            <button className={m.fill === '#ffffff' ? 'active' : ''} onClick={() => up({ fill: '#ffffff' })}>{t('rightpanel.apagar_branco')}</button>
          </div>
          <Field label={t('rightpanel.texto_de_substituicao_opcional_corrige')}><textarea rows={2} value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <Field label={t('rightpanel.tamanho_da_fonte')}><input type="number" min={4} max={72} value={m.fontSize} onChange={(e) => up({ fontSize: Number(e.target.value) })} /></Field>
          <span className="muted small">{t('rightpanel.o_conteudo_sob_a_tarja')}</span>
        </>
      )}
      {m.kind === 'image' && (
        <Field label={t('rightpanel.opacidade', { round: Math.round((m.opacity ?? 1) * 100) })}><TickSlider min={0.05} max={1} step={0.05} value={m.opacity ?? 1} onChange={(v) => up({ opacity: v })} /></Field>
      )}
      {m.kind === 'text' && (
        <>
          <Field label={t('rightpanel.texto')}><textarea rows={3} value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <Field label={t('rightpanel.tamanho_da_fonte')}><input type="number" min={6} max={72} value={m.fontSize} onChange={(e) => up({ fontSize: Number(e.target.value) })} /></Field>
        </>
      )}
      {(m.kind === 'area' || m.kind === 'space' || m.kind === 'solid') && (
        <div className="card holes-card">
          <div className="kv"><span>{t('rightpanel.vazios_fosso_shaft_pilar')}</span><b>{m.holes?.length ?? 0}</b></div>
          {(m.holes ?? []).map((h, i) => {
            const sc = scaleFor(m, s.markups, s.scales[m.page])
            const a = sc ? polyArea(h) * sc.metersPerUnit * sc.metersPerUnit : null
            return (
              <div key={i} className="hole-row">
                <SquareDashed size={13} /> <span className="grow">{t('rightpanel.vazio', { v: i + 1 })}</span>
                <span className="muted small">{a != null ? fmtQty(a, 'm²') : ''}</span>
                <button className="icon-btn xs" data-tip={t('rightpanel.remover_vazio')} onClick={() => up({ holes: m.holes!.filter((_, j) => j !== i) })}><X size={12} /></button>
              </div>
            )
          })}
          <div className="row">
            <button className="btn sm" onClick={() => s.set({ tool: 'hole', holeTarget: m.id })}><SquareDashed size={13} /> {t('rightpanel.desenhar_vazio')}</button>
            <button className="btn sm ghost" onClick={() => s.set({ tool: 'fill', fillAs: m.kind === 'space' ? 'space' : 'area', holeTarget: m.id })} data-tip={t('rightpanel.shift_clique_dentro_do_vazio')}>{t('rightpanel.por_clique')}</button>
          </div>
        </div>
      )}
      {m.kind === 'solid' && (
        <>
          <Field label={t('rightpanel.nome_do_solido')}><input value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="row">
            <Field label={t('rightpanel.base_m', { u: lenUnit() })}><input type="number" step={0.05} value={r3(lenIn(m.base ?? 0))} onChange={(e) => up({ base: lenOut(Number(e.target.value)) })} /></Field>
            <Field label={t('rightpanel.altura_m', { u: lenUnit() })}><input type="number" min={r3(lenIn(0.05))} step={r3(lenIn(0.05))} value={r3(lenIn(m.height ?? DEFAULT_SOLID_HEIGHT))} onChange={(e) => { const h = Math.max(0.05, lenOut(Number(e.target.value))); up({ height: h }); s.rememberSolid({ height: h }) }} /></Field>
            <Field label={t('rightpanel.cor')}><input type="color" value={m.color} onChange={(e) => { up({ color: e.target.value, fill: e.target.value }); s.rememberSolid({ color: e.target.value }) }} /></Field>
          </div>
          <div className="card">
            {q ? (
              <>
                <div className="kv"><span>{t('rightpanel.volume')}</span><b>{fmtQty(q.vars.VOL, 'm³')}</b></div>
                <div className="kv"><span>{t('rightpanel.area_da_base')}</span><b>{fmtQty(q.vars.A, 'm²')}</b></div>
                <div className="kv"><span>{t('rightpanel.area_lateral')}</span><b>{fmtQty(q.vars.AL, 'm²')}</b></div>
                <div className="kv"><span>{t('rightpanel.topo_na_cota')}</span><b>{fmtQty((m.base ?? 0) + (m.height ?? DEFAULT_SOLID_HEIGHT), 'm')}</b></div>
              </>
            ) : <span className="muted small">{t('rightpanel.defina_a_escala_da_folha')}</span>}
          </div>
          <span className="muted small"><Rich k="rightpanel.abra_o_modo_3d" /></span>
        </>
      )}
      {m.kind === 'space' && (
        <>
          <Field label={t('rightpanel.nome_do_ambiente')}><input value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="row">
            <Field label={t('rightpanel.cor')}><input type="color" value={m.color} onChange={(e) => up({ color: e.target.value, fill: e.target.value })} /></Field>
            <span className="muted small">{q ? t('rightpanel.m_m_de_perimetro', { v: fmtQty(q.vars.A, 'm²'), v2: fmtQty(q.vars.P, 'm') }) : t('rightpanel.defina_a_escala_para_medir')}</span>
          </div>
          <span className="muted small">{t('rightpanel.medicoes_cujo_centro_cai_dentro')}</span>
        </>
      )}
      {isMeasure && s.columns.some((c) => c.type !== 'formula') && (
        <div className="card">
          <span className="muted small">{t('rightpanel.colunas_personalizadas')}{spaceOf(m, s.markups) ? t('rightpanel.ambiente_x', { nome: spaceOf(m, s.markups)!.text }) : ''}</span>
          {s.columns.filter((c) => c.type !== 'formula').map((c) => (
            <Field key={c.id} label={c.name}>
              <input type={c.type === 'number' ? 'number' : 'text'} value={m.fields?.[c.id] ?? ''} onChange={(e) => s.updateMarkup(m.id, { fields: { ...m.fields, [c.id]: c.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value } }, false)} />
            </Field>
          ))}
        </div>
      )}
      {isIssue(m) && <IssueFields m={m} />}
      <Field label={t('rightpanel.status')}>
        <select value={m.status} onChange={(e) => up({ status: e.target.value })}>
          {s.statuses.map((x) => <option key={x.name}>{x.name}</option>)}
          {!s.statuses.some((x) => x.name === m.status) && <option>{m.status}</option>}
        </select>
      </Field>
      <button className="link" onClick={() => s.set({ dialog: 'statuses' })}>{t('rightpanel.gerenciar_status')}</button>
      <Field label={t('rightpanel.comentario')}>
        <textarea rows={3} value={m.comment} placeholder={t('rightpanel.observacao_ambiente_responsavel')} onChange={(e) => s.updateMarkup(m.id, { comment: e.target.value }, false)} />
      </Field>
      <div className="muted small">{m.author} · {new Date(m.createdAt).toLocaleString(localeOf())}</div>
      <button className="btn danger sm" onClick={() => s.removeMarkups([m.id])}><Trash2 size={14} /> {t('rightpanel.excluir')}</button>
    </div>
  )
}

function IssueFields({ m }: { m: Markup }) {
  const s = useStore()
  const [reply, setReply] = useState('')
  const no = issueList(s.markups).find((x) => x.m.id === m.id)?.no
  const people = Array.from(new Set(s.markups.map((x) => x.assignee).filter(Boolean))) as string[]
  const send = () => {
    if (!reply.trim()) return
    s.updateMarkup(m.id, { replies: [...(m.replies ?? []), { author: s.author, at: Date.now(), text: reply.trim() }] })
    setReply('')
  }
  return (
    <div className="card issue-card">
      <div className="kv"><span>{t('rightpanel.item_de_compatibilizacao')}</span><b>nº {String(m.issueNo ?? no ?? '').padStart(2, '0')}</b></div>
      <datalist id="people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      <Field label={t('rightpanel.responsavel')}><input list="people" value={m.assignee ?? ''} placeholder={t('rightpanel.ex_eletrica_fulano')} onChange={(e) => s.updateMarkup(m.id, { assignee: e.target.value }, false)} /></Field>
      <div className="row">
        <Field label={t('rightpanel.prioridade')}>
          <select value={m.priority ?? ''} onChange={(e) => s.updateMarkup(m.id, { priority: (e.target.value || undefined) as Markup['priority'] })}>
            <option value="">—</option><option value="alta">{t('rightpanel.alta')}</option><option value="média">{t('rightpanel.media')}</option><option value="baixa">{t('rightpanel.baixa')}</option>
          </select>
        </Field>
        <Field label={t('rightpanel.prazo')}><input type="date" value={m.due ?? ''} onChange={(e) => s.updateMarkup(m.id, { due: e.target.value || undefined })} /></Field>
      </div>
      <Field label={t('rightpanel.n_fixo')}><input type="number" min={1} value={m.issueNo ?? ''} placeholder={String(no ?? '')} onChange={(e) => s.updateMarkup(m.id, { issueNo: e.target.value ? Number(e.target.value) : undefined }, false)} /></Field>
      <div className="replies">
        {(m.replies ?? []).map((r, i) => (
          <div key={i} className="reply">
            <div className="muted small"><b>{r.author}</b> · {new Date(r.at).toLocaleString(localeOf())}
              <button className="icon-btn xs" data-tip={t('rightpanel.remover')} onClick={() => s.updateMarkup(m.id, { replies: m.replies!.filter((_, j) => j !== i) })}><X size={11} /></button>
            </div>
            <div>{r.text}</div>
          </div>
        ))}
        <div className="reply-new">
          <textarea rows={2} value={reply} placeholder={t('rightpanel.responder')} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }} />
          <button className="icon-btn" data-tip={t('rightpanel.enviar_ctrl_enter')} disabled={!reply.trim()} onClick={send}><Send size={14} /></button>
        </div>
      </div>
    </div>
  )
}

function Presets() {
  const s = useStore()
  const [q, setQ] = useState('')
  const groups = Array.from(new Set(s.presets.map((p) => p.group)))
  const list = s.presets.filter((p) => `${p.name} ${p.group} ${p.code}`.toLowerCase().includes(q.toLowerCase()))

  const activate = (p: Preset) => {
    if (s.activePreset === p.id) return s.set({ activePreset: null, tool: 'select' })
    s.set({ activePreset: p.id, tool: p.measure, selected: [] })
  }
  const add = () => s.set({ presetDialog: { id: null } })
  const exportLib = () => {
    const blob = new Blob([JSON.stringify(s.presets, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'biblioteca-marcadores.json'
    a.click()
  }
  const importLib = () => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = '.json'
    i.onchange = async () => {
      const f = i.files?.[0]
      if (!f) return
      try {
        const arr = JSON.parse(await f.text()) as Preset[]
        s.setPresets([...s.presets, ...arr.map((p) => ({ ...p, id: uid() }))])
        s.notify(t('rightpanel.marcadores_importados', { length: arr.length }))
      } catch {
        s.notify(t('rightpanel.arquivo_de_biblioteca_invalido'))
      }
    }
    i.click()
  }

  return (
    <div className="presets">
      <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <div className="pad-x toolbar-row">
        <input className="search" placeholder={t('rightpanel.buscar_marcador')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn sm primary new-preset" onClick={add}><Plus size={14} /> {t('rightpanel.novo')}</button>
      </div>
      {groups.map((g) => {
        const items = list.filter((p) => p.group === g)
        if (!items.length) return null
        return (
          <div key={g} className="preset-group">
            <div className="group-title">{g}</div>
            {items.map((p) => (
              <div key={p.id}>
                <div className={`preset ${s.activePreset === p.id ? 'active' : ''}`} onClick={() => activate(p)}>
                  <PresetSwatch p={p} />
                  <div className="preset-txt">
                    <span className="preset-name">{p.name}</span>
                    <span className="muted small">{MEASURE_LABEL[p.measure]}{p.formula ? ` = ${p.formula}` : p.factor !== 1 ? ` × ${fmt(p.factor)}` : ''} · {unitName(p.resultUnit)}{p.code ? ` · ${p.code}` : ''}</span>
                  </div>
                  <div className="preset-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn xs" data-tip={t('rightpanel.editar')} onClick={() => s.set({ presetDialog: { id: p.id } })}><Pencil size={13} /></button>
                    <button className="icon-btn xs" data-tip={t('rightpanel.duplicar')} onClick={() => { const i = s.presets.indexOf(p); const c = { ...p, id: uid(), name: t('rightpanel.copia_de', { nome: p.name }) }; s.setPresets([...s.presets.slice(0, i + 1), c, ...s.presets.slice(i + 1)]); s.set({ presetDialog: { id: c.id } }) }}><Copy size={13} /></button>
                    <button className="icon-btn xs" data-tip={t('rightpanel.excluir')} onClick={() => s.setPresets(s.presets.filter((x) => x.id !== p.id))}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}
      <div className="pad-x lib-actions">
        <button className="btn ghost sm" onClick={importLib}><Upload size={13} /> {t('rightpanel.importar')}</button>
        <button className="btn ghost sm" onClick={exportLib}><Download size={13} /> {t('rightpanel.exportar')}</button>
        <button className="btn ghost sm" onClick={() => s.setPresets(defaultPresets())}><RotateCcw size={13} /> {t('rightpanel.padrao')}</button>
      </div>
    </div>
  )
}

/** arredonda para não aparecer 9,180000000001 num campo depois da conversão de unidade */
const r3 = (x: number) => Math.round(x * 1000) / 1000

export function PresetSwatch({ p }: { p: Preset }) {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" className="swatch">
      {p.measure === 'area' && <rect x="2" y="2" width="24" height="16" rx="2" fill={p.color} fillOpacity={Math.max(0.25, p.opacity)} stroke={p.color} strokeWidth="1.5" />}
      {p.measure === 'length' && <path d="M3 15 L12 6 L25 12" fill="none" stroke={p.color} strokeWidth={Math.min(4, p.width)} strokeDasharray={p.dash === 'dash' ? '5 3' : p.dash === 'dot' ? '1.5 3' : undefined} strokeLinecap="round" />}
      {p.measure === 'count' && (
        <>
          <circle cx="14" cy="10" r="7" fill={p.color} />
          {(p.letter || p.symbol === 'letter') && <text x="14" y="10.5" fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="central" fill="#fff">{p.letter || '#'}</text>}
        </>
      )}
    </svg>
  )
}

const ClaudePanel = lazy(() => import('./ClaudePanel').then((m) => ({ default: m.ClaudePanel })))

export function RightPanel() {
  const tab = useStore((s) => s.rightTab)
  const selected = useStore((s) => s.selected.length)
  const set = useStore((s) => s.set)
  const cur = tab === 'claude' ? 'claude' : selected ? 'props' : tab
  return (
    <aside className="panel right">
      <header className="tabs">
        <button className={cur === 'presets' ? 'active' : ''} onClick={() => set({ selected: [], rightTab: 'presets' })}>{t('rightpanel.marcadores')}</button>
        <button className={cur === 'props' ? 'active' : ''} onClick={() => set({ rightTab: 'props' })}>{t('rightpanel.propriedades')}</button>
        <button className={`claude-tab ${cur === 'claude' ? 'active' : ''}`} onClick={() => set({ rightTab: 'claude' })}><Sparkles size={13} /> Claude</button>
        <div className="spacer" />
        <button className="icon-btn xs panel-hide" data-tip={t('rightpanel.ocultar_painel_ctrl_3')} onClick={() => set({ panels: { ...useStore.getState().panels, right: false } })}><ChevronsRight size={15} /></button>
      </header>
      <div className="panel-body">
        {cur === 'claude' ? (
          <Suspense fallback={<div className="loading-mod">{t('rightpanel.carregando')}</div>}><ClaudePanel /></Suspense>
        ) : cur === 'props' ? <Props /> : <Presets />}
      </div>
    </aside>
  )
}
