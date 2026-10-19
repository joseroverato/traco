import { Suspense, lazy, useState } from 'react'
import { ChevronsRight, Copy, Download, Pencil, Plus, RotateCcw, Send, Sparkles, SquareDashed, Trash2, Upload, X } from 'lucide-react'
import { defaultPresets, uid, useStore } from '../store'
import type { Markup, Preset } from '../types'
import { DEFAULT_SOLID_HEIGHT, fmt, measureOf, polyArea, scaleFor } from '../geometry'
import { isIssue, issueList } from '../issues'
import { spaceOf } from '../columns'
import { IS_DESKTOP } from '../platform'

export const KIND_LABEL: Record<Markup['kind'], string> = {
  rect: 'Retângulo', ellipse: 'Elipse', cloud: 'Nuvem', arrow: 'Seta', line: 'Linha', text: 'Texto',
  length: 'Comprimento', area: 'Área', count: 'Contagem', stamp: 'Carimbo', image: 'Imagem', viewport: 'Viewport', redact: 'Tarja / correção', space: 'Ambiente', solid: 'Sólido 3D', legend: 'Legenda',
}
const MEASURE_LABEL = { length: 'Comprimento', area: 'Área', count: 'Contagem' }

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
        <p className="muted">Selecione uma marcação para editar suas propriedades.</p>
        {sh && (
          <div className="card">
            <div className="kv"><span>Folha</span><b>{sh.label}</b></div>
            <div className="kv"><span>Escala</span><b>{sc ? sc.label : '—'}</b></div>
            <div className="kv"><span>Viewports</span><b>{s.markups.filter((m) => m.page === sh.id && m.kind === 'viewport').length}</b></div>
            <div className="kv"><span>Marcações</span><b>{s.markups.filter((m) => m.page === sh.id && m.kind !== 'viewport').length}</b></div>
            <button className="btn sm" onClick={() => s.set({ calibrating: { page: sh.id, length: 0 } })}>Definir escala</button>
          </div>
        )}
      </div>
    )
  }
  if (sel.length > 1) {
    return (
      <div className="pad stack">
        <p><b>{sel.length}</b> marcações selecionadas</p>
        <Field label="Status">
          <select onChange={(e) => s.setStatus(s.selected, e.target.value)} defaultValue="">
            <option value="" disabled>Alterar status…</option>
            {s.statuses.map((x) => <option key={x.name}>{x.name}</option>)}
          </select>
        </Field>
        <button className="btn danger sm" onClick={() => s.removeMarkups(s.selected)}><Trash2 size={14} /> Excluir</button>
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
              <div className="big">{q.error ? '—' : fmt(q.value)} <small>{q.unit}</small></div>
              {q.error && <div className="warn">Fórmula: {q.error}</div>}
              <div className="vars muted small">
                {m.kind === 'length' && <span>L {fmt(q.vars.L)} m</span>}
                {m.kind === 'area' && <><span>A {fmt(q.vars.A)} m²</span><span>P {fmt(q.vars.P)} m</span>{q.vars.V > 0 && <span>V {fmt(q.vars.V)} m²</span>}</>}
                {m.kind === 'count' && <span>N {q.vars.N}</span>}
                {preset && preset.factor !== 1 && <span>H {fmt(preset.factor)}</span>}
                {preset?.formula && <span className="mono">= {preset.formula}</span>}
              </div>
            </>
          ) : (
            <div className="muted">Defina a escala da folha para medir.</div>
          )}
        </div>
      )}
      {isMeasure && (
        <Field label="Marcador de quantitativo">
          <select
            value={m.presetId ?? ''}
            onChange={(e) => {
              const p = s.presets.find((x) => x.id === e.target.value)
              up(p ? { presetId: p.id, color: p.color, fill: p.color, width: p.width, fillOpacity: p.opacity } : { presetId: null })
            }}
          >
            <option value="">— sem marcador —</option>
            {s.presets.filter((p) => p.measure === m.kind).map((p) => <option key={p.id} value={p.id}>{p.group} · {p.name}</option>)}
          </select>
        </Field>
      )}
      {(m.kind === 'length' || m.kind === 'area') && (
        <label className="check">
          <input type="checkbox" checked={m.deduct} onChange={(e) => up({ deduct: e.target.checked })} />
          Dedução (vão / desconto)
        </label>
      )}
      {!preset && !['stamp', 'image', 'viewport', 'redact'].includes(m.kind) && (
        <div className="row">
          <Field label="Cor"><input type="color" value={m.color} onChange={(e) => up({ color: e.target.value, fill: e.target.value })} /></Field>
          <Field label="Espessura"><input type="number" min={0.25} step={0.25} value={m.width} onChange={(e) => up({ width: Number(e.target.value) })} /></Field>
          {m.kind !== 'text' && m.kind !== 'count' && m.kind !== 'line' && m.kind !== 'arrow' && m.kind !== 'length' && (
            <Field label="Preench."><input type="range" min={0} max={0.8} step={0.05} value={m.fillOpacity} onChange={(e) => up({ fillOpacity: Number(e.target.value) })} /></Field>
          )}
        </div>
      )}
      {m.kind === 'viewport' && (
        <>
          <Field label="Nome do viewport"><input value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="card">
            <div className="kv"><span>Escala</span><b>{m.scale?.label ?? '—'}</b></div>
            <button className="btn sm" onClick={() => s.set({ calibrating: { page: m.page, length: 0, viewport: m.id } })}>Definir escala</button>
            <span className="muted small">Medições que começam dentro deste retângulo usam esta escala. Para calibrar por cota, use a ferramenta Calibrar dentro dele.</span>
          </div>
        </>
      )}
      {m.kind === 'stamp' && (
        <>
          <Field label="Texto (variáveis: {data} {hora} {folha} {n} {total} {autor} {arquivo})"><textarea rows={3} value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="row">
            <Field label="Cor"><input type="color" value={m.color} onChange={(e) => up({ color: e.target.value })} /></Field>
            <Field label="Fonte"><input type="number" min={6} max={200} value={m.fontSize} onChange={(e) => up({ fontSize: Number(e.target.value) })} /></Field>
            <Field label="Borda"><input type="number" min={0} step={0.5} value={m.width} onChange={(e) => up({ width: Number(e.target.value) })} /></Field>
          </div>
          <div className="row">
            <Field label={`Rotação ${m.angle ?? 0}°`}><input type="range" min={-90} max={90} step={5} value={m.angle ?? 0} onChange={(e) => up({ angle: Number(e.target.value) })} /></Field>
            <Field label={`Opacidade ${Math.round((m.opacity ?? 1) * 100)}%`}><input type="range" min={0.05} max={1} step={0.05} value={m.opacity ?? 1} onChange={(e) => up({ opacity: Number(e.target.value) })} /></Field>
          </div>
        </>
      )}
      {m.kind === 'redact' && (
        <>
          <div className="seg wide">
            <button className={m.fill === '#000000' ? 'active' : ''} onClick={() => up({ fill: '#000000' })}>Tarja preta</button>
            <button className={m.fill === '#ffffff' ? 'active' : ''} onClick={() => up({ fill: '#ffffff' })}>Apagar (branco)</button>
          </div>
          <Field label="Texto de substituição (opcional — corrige o texto do PDF)"><textarea rows={2} value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <Field label="Tamanho da fonte"><input type="number" min={4} max={72} value={m.fontSize} onChange={(e) => up({ fontSize: Number(e.target.value) })} /></Field>
          <span className="muted small">{IS_DESKTOP ? 'No app de PC o conteúdo sob a tarja é removido de verdade ao exportar.' : 'Na versão web a tarja é só visual (cobre o conteúdo). Para remoção definitiva, exporte pelo app de PC.'}</span>
        </>
      )}
      {m.kind === 'image' && (
        <Field label={`Opacidade ${Math.round((m.opacity ?? 1) * 100)}%`}><input type="range" min={0.05} max={1} step={0.05} value={m.opacity ?? 1} onChange={(e) => up({ opacity: Number(e.target.value) })} /></Field>
      )}
      {m.kind === 'text' && (
        <>
          <Field label="Texto"><textarea rows={3} value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <Field label="Tamanho da fonte"><input type="number" min={6} max={72} value={m.fontSize} onChange={(e) => up({ fontSize: Number(e.target.value) })} /></Field>
        </>
      )}
      {(m.kind === 'area' || m.kind === 'space' || m.kind === 'solid') && (
        <div className="card holes-card">
          <div className="kv"><span>Vazios (fosso, shaft, pilar)</span><b>{m.holes?.length ?? 0}</b></div>
          {(m.holes ?? []).map((h, i) => {
            const sc = scaleFor(m, s.markups, s.scales[m.page])
            const a = sc ? polyArea(h) * sc.metersPerUnit * sc.metersPerUnit : null
            return (
              <div key={i} className="hole-row">
                <SquareDashed size={13} /> <span className="grow">Vazio {i + 1}</span>
                <span className="muted small">{a != null ? `${fmt(a)} m²` : ''}</span>
                <button className="icon-btn xs" data-tip="Remover vazio" onClick={() => up({ holes: m.holes!.filter((_, j) => j !== i) })}><X size={12} /></button>
              </div>
            )
          })}
          <div className="row">
            <button className="btn sm" onClick={() => s.set({ tool: 'hole', holeTarget: m.id })}><SquareDashed size={13} /> Desenhar vazio</button>
            <button className="btn sm ghost" onClick={() => s.set({ tool: 'fill', fillAs: m.kind === 'space' ? 'space' : 'area', holeTarget: m.id })} data-tip="Shift+clique dentro do vazio">Por clique</button>
          </div>
        </div>
      )}
      {m.kind === 'solid' && (
        <>
          <Field label="Nome do sólido"><input value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="row">
            <Field label="Base (m)"><input type="number" step={0.05} value={m.base ?? 0} onChange={(e) => up({ base: Number(e.target.value) })} /></Field>
            <Field label="Altura (m)"><input type="number" min={0.05} step={0.05} value={m.height ?? DEFAULT_SOLID_HEIGHT} onChange={(e) => { const h = Math.max(0.05, Number(e.target.value)); up({ height: h }); s.rememberSolid({ height: h }) }} /></Field>
            <Field label="Cor"><input type="color" value={m.color} onChange={(e) => { up({ color: e.target.value, fill: e.target.value }); s.rememberSolid({ color: e.target.value }) }} /></Field>
          </div>
          <div className="card">
            {q ? (
              <>
                <div className="kv"><span>Volume</span><b>{fmt(q.vars.VOL)} m³</b></div>
                <div className="kv"><span>Área da base</span><b>{fmt(q.vars.A)} m²</b></div>
                <div className="kv"><span>Área lateral</span><b>{fmt(q.vars.AL)} m²</b></div>
                <div className="kv"><span>Topo na cota</span><b>{fmt((m.base ?? 0) + (m.height ?? DEFAULT_SOLID_HEIGHT))} m</b></div>
              </>
            ) : <span className="muted small">Defina a escala da folha para medir.</span>}
          </div>
          <span className="muted small">Abra o modo <b>3D</b> para ver o sólido e puxar/empurrar a altura com o mouse.</span>
        </>
      )}
      {m.kind === 'space' && (
        <>
          <Field label="Nome do ambiente"><input value={m.text} onChange={(e) => s.updateMarkup(m.id, { text: e.target.value }, false)} /></Field>
          <div className="row">
            <Field label="Cor"><input type="color" value={m.color} onChange={(e) => up({ color: e.target.value, fill: e.target.value })} /></Field>
            <span className="muted small">{q ? `${fmt(q.vars.A)} m² · ${fmt(q.vars.P)} m de perímetro` : 'Defina a escala para medir.'}</span>
          </div>
          <span className="muted small">Medições cujo centro cai dentro deste ambiente são agrupadas nele na tabela (Agrupar por → Ambiente).</span>
        </>
      )}
      {isMeasure && s.columns.some((c) => c.type !== 'formula') && (
        <div className="card">
          <span className="muted small">Colunas personalizadas{spaceOf(m, s.markups) ? ` · ambiente ${spaceOf(m, s.markups)!.text}` : ''}</span>
          {s.columns.filter((c) => c.type !== 'formula').map((c) => (
            <Field key={c.id} label={c.name}>
              <input type={c.type === 'number' ? 'number' : 'text'} value={m.fields?.[c.id] ?? ''} onChange={(e) => s.updateMarkup(m.id, { fields: { ...m.fields, [c.id]: c.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value } }, false)} />
            </Field>
          ))}
        </div>
      )}
      {isIssue(m) && <IssueFields m={m} />}
      <Field label="Status">
        <select value={m.status} onChange={(e) => up({ status: e.target.value })}>
          {s.statuses.map((x) => <option key={x.name}>{x.name}</option>)}
          {!s.statuses.some((x) => x.name === m.status) && <option>{m.status}</option>}
        </select>
      </Field>
      <button className="link" onClick={() => s.set({ dialog: 'statuses' })}>Gerenciar status…</button>
      <Field label="Comentário">
        <textarea rows={3} value={m.comment} placeholder="Observação, ambiente, responsável…" onChange={(e) => s.updateMarkup(m.id, { comment: e.target.value }, false)} />
      </Field>
      <div className="muted small">{m.author} · {new Date(m.createdAt).toLocaleString('pt-BR')}</div>
      <button className="btn danger sm" onClick={() => s.removeMarkups([m.id])}><Trash2 size={14} /> Excluir</button>
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
      <div className="kv"><span>Item de compatibilização</span><b>nº {String(m.issueNo ?? no ?? '').padStart(2, '0')}</b></div>
      <datalist id="people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      <Field label="Responsável"><input list="people" value={m.assignee ?? ''} placeholder="ex.: Elétrica — Fulano" onChange={(e) => s.updateMarkup(m.id, { assignee: e.target.value }, false)} /></Field>
      <div className="row">
        <Field label="Prioridade">
          <select value={m.priority ?? ''} onChange={(e) => s.updateMarkup(m.id, { priority: (e.target.value || undefined) as Markup['priority'] })}>
            <option value="">—</option><option value="alta">Alta</option><option value="média">Média</option><option value="baixa">Baixa</option>
          </select>
        </Field>
        <Field label="Prazo"><input type="date" value={m.due ?? ''} onChange={(e) => s.updateMarkup(m.id, { due: e.target.value || undefined })} /></Field>
      </div>
      <Field label="Nº fixo"><input type="number" min={1} value={m.issueNo ?? ''} placeholder={String(no ?? '')} onChange={(e) => s.updateMarkup(m.id, { issueNo: e.target.value ? Number(e.target.value) : undefined }, false)} /></Field>
      <div className="replies">
        {(m.replies ?? []).map((r, i) => (
          <div key={i} className="reply">
            <div className="muted small"><b>{r.author}</b> · {new Date(r.at).toLocaleString('pt-BR')}
              <button className="icon-btn xs" data-tip="Remover" onClick={() => s.updateMarkup(m.id, { replies: m.replies!.filter((_, j) => j !== i) })}><X size={11} /></button>
            </div>
            <div>{r.text}</div>
          </div>
        ))}
        <div className="reply-new">
          <textarea rows={2} value={reply} placeholder="Responder…" onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }} />
          <button className="icon-btn" data-tip="Enviar  Ctrl+Enter" disabled={!reply.trim()} onClick={send}><Send size={14} /></button>
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
        s.notify(`${arr.length} marcadores importados`)
      } catch {
        s.notify('Arquivo de biblioteca inválido')
      }
    }
    i.click()
  }

  return (
    <div className="presets">
      <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <div className="pad-x toolbar-row">
        <input className="search" placeholder="Buscar marcador…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn sm primary new-preset" onClick={add}><Plus size={14} /> Novo</button>
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
                    <span className="muted small">{MEASURE_LABEL[p.measure]}{p.formula ? ` = ${p.formula}` : p.factor !== 1 ? ` × ${fmt(p.factor)}` : ''} · {p.resultUnit}{p.code ? ` · ${p.code}` : ''}</span>
                  </div>
                  <div className="preset-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn xs" data-tip="Editar" onClick={() => s.set({ presetDialog: { id: p.id } })}><Pencil size={13} /></button>
                    <button className="icon-btn xs" data-tip="Duplicar" onClick={() => { const i = s.presets.indexOf(p); const c = { ...p, id: uid(), name: `${p.name} (cópia)` }; s.setPresets([...s.presets.slice(0, i + 1), c, ...s.presets.slice(i + 1)]); s.set({ presetDialog: { id: c.id } }) }}><Copy size={13} /></button>
                    <button className="icon-btn xs" data-tip="Excluir" onClick={() => s.setPresets(s.presets.filter((x) => x.id !== p.id))}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}
      <div className="pad-x lib-actions">
        <button className="btn ghost sm" onClick={importLib}><Upload size={13} /> Importar</button>
        <button className="btn ghost sm" onClick={exportLib}><Download size={13} /> Exportar</button>
        <button className="btn ghost sm" onClick={() => s.setPresets(defaultPresets())}><RotateCcw size={13} /> Padrão</button>
      </div>
    </div>
  )
}

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
  const t = tab === 'claude' ? 'claude' : selected ? 'props' : tab
  return (
    <aside className="panel right">
      <header className="tabs">
        <button className={t === 'presets' ? 'active' : ''} onClick={() => set({ selected: [], rightTab: 'presets' })}>Marcadores</button>
        <button className={t === 'props' ? 'active' : ''} onClick={() => set({ rightTab: 'props' })}>Propriedades</button>
        <button className={`claude-tab ${t === 'claude' ? 'active' : ''}`} onClick={() => set({ rightTab: 'claude' })}><Sparkles size={13} /> Claude</button>
        <div className="spacer" />
        <button className="icon-btn xs panel-hide" data-tip="Ocultar painel  Ctrl+3" onClick={() => set({ panels: { ...useStore.getState().panels, right: false } })}><ChevronsRight size={15} /></button>
      </header>
      <div className="panel-body">
        {t === 'claude' ? (
          <Suspense fallback={<div className="loading-mod">Carregando…</div>}><ClaudePanel /></Suspense>
        ) : t === 'props' ? <Props /> : <Presets />}
      </div>
    </aside>
  )
}
