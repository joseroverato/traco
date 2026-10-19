import { useState } from 'react'
import { FileSpreadsheet, FileText, Hash } from 'lucide-react'
import { curSheet, useStore } from '../store'
import { issueList, renumber } from '../issues'
import type { ReportFilter } from '../issues'

const PRI_COLOR = { alta: '#e5484d', média: '#ffb224', baixa: '#8b8d98' } as const

/** Lista de itens de compatibilização (nuvens, retângulos, setas, textos) e relatório. */
export function IssuesPanel() {
  const s = useStore()
  const cur = curSheet(s)
  const [status, setStatus] = useState('')
  const [assignee, setAssignee] = useState('')
  const [onlyCur, setOnlyCur] = useState(false)
  const [busy, setBusy] = useState('')
  const all = issueList(s.markups)
  const people = Array.from(new Set(all.map((x) => x.m.assignee).filter(Boolean))) as string[]
  const f: ReportFilter = { status: status || undefined, assignee: assignee || undefined, sheet: onlyCur ? cur?.id : undefined }
  const list = all.filter(({ m }) => (!f.status || m.status === f.status) && (!f.assignee || m.assignee === f.assignee) && (!f.sheet || m.page === f.sheet))

  const run = async (fn: () => Promise<unknown>) => {
    setBusy('Gerando…')
    try {
      await fn()
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="dock-body">
      <p className="muted small dock-note">Cada nuvem, retângulo, seta ou texto vira um item numerado com responsável, prioridade, prazo e respostas.</p>
      <div className="stack tight" style={{ padding: '6px 4px' }}>
        <div className="row">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {s.statuses.map((x) => <option key={x.name}>{x.name}</option>)}
          </select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {people.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <label className="check"><input type="checkbox" checked={onlyCur} onChange={(e) => setOnlyCur(e.target.checked)} /> Só a folha atual</label>
      </div>
      <div className="issue-list">
        {list.length === 0 && <p className="muted small dock-note">Nenhum item. Use Nuvem (C), Retângulo (R) ou Seta (A) para apontar problemas.</p>}
        {list.map(({ m, no }) => {
          const st = s.statuses.find((x) => x.name === m.status)
          return (
            <button key={m.id} className={`issue ${s.selected.includes(m.id) ? 'active' : ''}`} onClick={() => s.set({ page: Math.max(0, s.sheets.findIndex((x) => x.id === m.page)), selected: [m.id], tool: 'select', rightTab: 'props', panels: { ...s.panels, right: true } })}>
              <span className="issue-no">{String(no).padStart(2, '0')}</span>
              <span className="issue-body">
                <span className="issue-title">{(m.text || m.comment || 'Sem descrição').split('\n')[0]}</span>
                <span className="muted small">{s.sheets.find((x) => x.id === m.page)?.label}{m.assignee ? ` · ${m.assignee}` : ''}{m.replies?.length ? ` · ${m.replies.length} resposta(s)` : ''}</span>
              </span>
              {m.priority && <span className="pri" style={{ background: PRI_COLOR[m.priority] }} title={`prioridade ${m.priority}`} />}
              <span className="status" style={{ color: st?.color, background: `color-mix(in srgb, ${st?.color ?? '#888'} 16%, transparent)` }}>{m.status}</span>
            </button>
          )
        })}
      </div>
      <div className="dock-group">Relatório ({list.length} itens)</div>
      {busy ? <p className="muted small dock-note">{busy}</p> : (
        <>
          <button className="dock-action" disabled={!list.length} onClick={() => run(async () => (await import('../issuesReport')).issuesPdf(f, setBusy))}><FileText size={17} /><span className="grow">Relatório PDF com recortes</span></button>
          <button className="dock-action" disabled={!list.length} onClick={() => run(async () => (await import('../issuesReport')).issuesXlsx(f))}><FileSpreadsheet size={17} /><span className="grow">Planilha Excel</span></button>
          <button className="dock-action" onClick={() => { renumber(); s.notify('Itens numerados de 1 em diante') }}><Hash size={17} /><span className="grow">Renumerar itens</span></button>
        </>
      )}
    </div>
  )
}
