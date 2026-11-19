import { useStore } from '../../store'
import { issueList } from '../../issues'
import { setIssueFilter, visibleIssues } from '../../issueOps'
import { priorityLabel } from '../../kinds'
import { SelectCb } from './SelectCb'
import { selectMarkup } from './select'
import { t } from '../../i18n'

/** Itens de compatibilização (nuvens, retângulos, setas, textos): filtros e lista numerada. Relatório e renumerar ficam na faixa (Anotar). */
export function IssuesPalette() {
  const statuses = useStore((s) => s.statuses)
  const sheets = useStore((s) => s.sheets)
  const markups = useStore((s) => s.markups)
  const selected = useStore((s) => s.selected)
  const filter = useStore((s) => s.issueFilter)
  const busy = useStore((s) => s.issuesBusy)
  const page = useStore((s) => s.page)
  const all = issueList(markups)
  const people = Array.from(new Set(all.map((x) => x.m.assignee).filter(Boolean))) as string[]
  const list = visibleIssues({ markups, issueFilter: filter, sheets, page })
  return (
    <div>
      <p className="pvz">{t('issuespanel.cada_nuvem_retangulo_seta_ou')}</p>
      <div className="pbar">
        <SelectCb className="grow" value={filter.status} onChange={(v) => setIssueFilter({ status: v })} label={t('issuespanel.todos_os_status')} current={filter.status || t('issuespanel.todos_os_status')}>
          <option value="">{t('issuespanel.todos_os_status')}</option>
          {statuses.map((x) => <option key={x.name}>{x.name}</option>)}
        </SelectCb>
      </div>
      <div className="pbar">
        <SelectCb className="grow" value={filter.assignee} onChange={(v) => setIssueFilter({ assignee: v })} label={t('issuespanel.todos_os_responsaveis')} current={filter.assignee || t('issuespanel.todos_os_responsaveis')}>
          <option value="">{t('issuespanel.todos_os_responsaveis')}</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </SelectCb>
      </div>
      <label className="pbar chk"><input type="checkbox" checked={filter.onlyCur} onChange={(e) => setIssueFilter({ onlyCur: e.target.checked })} />{t('issuespanel.so_a_folha_atual')}</label>
      {busy && <p className="pvz">{busy}</p>}
      {list.length === 0 && <p className="pvz">{t('issuespanel.nenhum_item_use_nuvem_c')}</p>}
      <div role="list">
        {list.map(({ m, no }) => {
          const on = selected.includes(m.id)
          const st = statuses.find((x) => x.name === m.status)
          return (
            <button key={m.id} type="button" role="listitem" className={`it${on ? ' on' : ''}`} aria-current={on} onClick={() => selectMarkup(m)}>
              <span className="it-n">{String(no).padStart(2, '0')}</span>
              <span className="it-t">{(m.text || m.comment || t('issuespanel.sem_descricao')).split('\n')[0]}</span>
              <span className="it-d">{m.due ? new Date(m.due + 'T00:00').toLocaleDateString() : ''}</span>
              <span className="it-m">{sheets.find((x) => x.id === m.page)?.label}{m.assignee ? ` · ${m.assignee}` : ''}{m.replies?.length ? ` · ${t('issuespanel.resposta_s', { length: m.replies.length })}` : ''}</span>
              <span className="it-p it-pri" title={m.priority ? t('issuespanel.prioridade', { priority: priorityLabel(m.priority) }) : undefined}>
                {st && <i className="cz" style={{ background: st.color }} />}{m.status}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
