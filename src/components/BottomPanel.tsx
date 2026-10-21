import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { ChevronsDown, FileSpreadsheet } from 'lucide-react'
import { curSheet, useStore } from '../store'
import { fmt, measureOf, scaleFor } from '../geometry'
import { displayRows, summarize } from '../summary'
import type { GroupBy } from '../summary'
import { spaceOf } from '../columns'
import { KIND_LABEL } from '../kinds'
import { t } from '../i18n'

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'preset', get label() { return t('bottompanel.servico') } },
  { id: 'space', get label() { return t('bottompanel.ambiente') } },
  { id: 'level', get label() { return t('bottompanel.pavimento') } },
  { id: 'sheet', get label() { return t('bottompanel.folha') } },
  { id: 'status', get label() { return t('bottompanel.status') } },
]

export function BottomPanel() {
  const s = useStore()
  const [tab, setTab] = useState<'qty' | 'list'>('qty')
  const [filter, setFilter] = useState('')
  const [scope, setScope] = useState<'all' | 'page'>('all')
  const cur = curSheet(s)
  const by = s.groupBy
  // com milhares de marcações o resumo leva centenas de ms: calcula em segundo plano para não travar o desenho
  const markups = useDeferredValue(s.markups)
  const source = useMemo(() => (scope === 'page' ? markups.filter((m) => m.page === cur?.id) : markups).filter((m) => m.kind !== 'viewport'), [scope, markups, cur?.id])
  const sum = useMemo(() => displayRows(summarize(source, s.presets, s.scales, s.sheets, markups, by, s.columns)), [source, s.presets, s.scales, s.sheets, markups, by, s.columns])
  const total = sum.reduce((a, r) => a + r.total, 0)
  const list = source.filter((m) => !filter || m.status === filter)
  const buckets = by === 'preset' ? [''] : Array.from(new Set(sum.map((r) => r.bucket)))
  const cols = s.columns
  const nCols = 11 + cols.length

  return (
    <section className="panel bottom">
      <header className="tabs">
        <button className={tab === 'qty' ? 'active' : ''} onClick={() => setTab('qty')}>{t('bottompanel.quantitativo')}</button>
        <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>{t('bottompanel.marcacoes')} <span className="count">{s.markups.length}</span></button>
        <div className="tabs-tools">
        {tab === 'qty' && (
          <label className="inline-label">{t('bottompanel.agrupar')}<select className="sm-select" value={by} onChange={(e) => s.set({ groupBy: e.target.value as GroupBy })}>
              {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
        )}
        <div className="seg">
          <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>{t('bottompanel.todas')}</button>
          <button className={scope === 'page' ? 'active' : ''} onClick={() => setScope('page')}>{t('bottompanel.esta_folha')}</button>
        </div>
        {tab === 'list' && (
          <select className="sm-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{t('bottompanel.todos_os_status')}</option>
            {s.statuses.map((x) => <option key={x.name}>{x.name}</option>)}
          </select>
        )}
        <button className="btn sm" disabled={!s.markups.length} onClick={async () => (await import('../xlsxExport')).exportXlsx(s.fileName, s.markups.filter((m) => m.kind !== 'viewport'), s.presets, s.scales, s.sheets)}>
          <FileSpreadsheet size={14} /> {t('bottompanel.planilha')}</button>
        </div>
        <button className="icon-btn xs panel-hide" data-tip={t('bottompanel.ocultar_quantitativo_ctrl_2')} onClick={() => s.set({ panels: { ...s.panels, bottom: false } })}><ChevronsDown size={15} /></button>
      </header>
      <div className="table-wrap">
        {tab === 'qty' ? (
          <table>
            <thead>
              <tr>
                <th></th><th>{t('bottompanel.grupo')}</th><th>{t('bottompanel.codigo')}</th><th>{t('bottompanel.servico')}</th><th>{t('bottompanel.folhas')}</th><th className="num">{t('bottompanel.itens')}</th><th className="num">{t('bottompanel.bruto')}</th><th className="num">{t('bottompanel.fator')}</th><th className="num">{t('bottompanel.quantidade')}</th><th>Un.</th>
                {cols.map((c) => <th key={c.id} className={c.type === 'text' ? '' : 'num'}>{c.name}</th>)}
                <th className="num">{t('bottompanel.total_r')}</th>
              </tr>
            </thead>
            <tbody>
              {sum.length === 0 && <tr><td colSpan={nCols} className="muted empty-row">{t('bottompanel.use_as_ferramentas_de_medicao')}</td></tr>}
              {buckets.map((b) => {
                const rows = sum.filter((r) => r.bucket === b)
                const sub = rows.reduce((t, r) => t + r.total, 0)
                return (
                  <Fragment key={b || '_'}>
                    {by !== 'preset' && (
                      <tr className="bucket-row"><td colSpan={nCols - 1}>{b}</td><td className="num">{sub ? `R$ ${fmt(sub)}` : ''}</td></tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td><span className="dot" style={{ background: r.color }} /></td>
                        <td>{r.group}</td>
                        <td className="mono">{r.code}</td>
                        <td>{r.name}{r.unscaled ? <span className="warn" title={t('bottompanel.itens_em_folhas_sem_escala')}> {t('bottompanel.sem_escala', { unscaled: r.unscaled })}</span> : null}</td>
                        <td className="muted">{r.sheets}</td>
                        <td className="num">{r.items}</td>
                        <td className="num">{fmt(r.raw)} {r.rawUnit}</td>
                        <td className="num">{r.factor !== 1 ? fmt(r.factor) : '—'}</td>
                        <td className="num strong">{fmt(r.qty)}</td>
                        <td>{r.unit}</td>
                        {cols.map((c) => <td key={c.id} className={c.type === 'text' ? 'muted' : 'num'}>{typeof r.fields[c.id] === 'number' ? fmt(r.fields[c.id] as number) : r.fields[c.id] ?? ''}</td>)}
                        <td className="num">{r.price ? fmt(r.total) : '—'}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr><td colSpan={nCols - 1}>{t('bottompanel.total_sem_bdi')}</td><td className="num strong">R$ {fmt(total)}</td></tr>
                {s.bdi > 0 && <tr><td colSpan={nCols - 1}>{t('bottompanel.total_com_bdi', { v: fmt(s.bdi) })}</td><td className="num strong">R$ {fmt(total * (1 + s.bdi / 100))}</td></tr>}
              </tfoot>
            )}
          </table>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>{t('bottompanel.folha')}</th><th>{t('bottompanel.tipo')}</th><th>{t('bottompanel.marcador_texto')}</th><th>{t('bottompanel.ambiente')}</th><th className="num">{t('bottompanel.medida')}</th><th>{t('bottompanel.status')}</th><th>{t('bottompanel.comentario')}</th><th>{t('bottompanel.autor')}</th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={9} className="muted empty-row">{t('bottompanel.nenhuma_marcacao')}</td></tr>}
              {list.map((m) => {
                const p = s.presets.find((x) => x.id === m.presetId)
                const q = measureOf(m, scaleFor(m, s.markups, s.scales[m.page]), p)
                const st = s.statuses.find((x) => x.name === m.status)
                return (
                  <tr key={m.id} className={s.selected.includes(m.id) ? 'sel' : ''} onClick={() => s.set({ page: Math.max(0, s.sheets.findIndex((x) => x.id === m.page)), selected: [m.id], tool: 'select', mode: 'review' })}>
                    <td className="muted">{s.markups.indexOf(m) + 1}</td>
                    <td>{s.sheets.find((x) => x.id === m.page)?.label}</td>
                    <td><span className="dot" style={{ background: m.color }} /> {KIND_LABEL[m.kind]}</td>
                    <td>{p?.name ?? (m.kind === 'image' ? '—' : m.text.split('\n')[0])}</td>
                    <td className="muted">{spaceOf(m, s.markups)?.text ?? ''}</td>
                    <td className="num">{q ? `${fmt(q.value)} ${q.unit}` : '—'}</td>
                    <td><span className="status" style={{ color: st?.color, background: `color-mix(in srgb, ${st?.color ?? '#888'} 16%, transparent)` }}>{m.status}</span></td>
                    <td className="muted ellipsis">{m.comment}</td>
                    <td className="muted">{m.author}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
