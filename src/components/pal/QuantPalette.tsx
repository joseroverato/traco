import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { curSheet, useStore } from '../../store'
import { fmt, measureOf, scaleFor } from '../../geometry'
import { displayRows, summarize } from '../../summary'
import type { GroupBy } from '../../summary'
import { spaceOf } from '../../columns'
import { KIND_LABEL } from '../../kinds'
import { Glyph, Icon } from '../Icon'
import { SelectCb } from './SelectCb'
import { Sample } from './Sample'
import { t } from '../../i18n'

const GROUPS: { id: GroupBy; label: () => string }[] = [
  { id: 'preset', label: () => t('bottompanel.servico') },
  { id: 'space', label: () => t('bottompanel.ambiente') },
  { id: 'level', label: () => t('bottompanel.pavimento') },
  { id: 'sheet', label: () => t('bottompanel.folha') },
  { id: 'status', label: () => t('bottompanel.status') },
]

/** Paleta inferior (132 px): abas Quantitativo e Marcações, Agrupar, folhas, Planilha e os dois totais na barra. */
export function QuantPalette() {
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
  const withBdi = s.bdi > 0

  return (
    <section className="rx pal-col bottom" aria-label={t('bottompanel.quantitativo')}>
      <div className="pal pb">
        <header className="ph">
          <span className="grip" aria-hidden="true"><Glyph name="grip" size={12} /></span>
          <div className="phtabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'qty'} className={tab === 'qty' ? 'on' : ''} onClick={() => setTab('qty')}>{t('bottompanel.quantitativo')}</button>
            <button type="button" role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>{t('bottompanel.marcacoes')} <span className="cnt">{source.length}</span></button>
          </div>
          {tab === 'qty' && (
            <>
              <span className="lb">{t('bottompanel.agrupar')}</span>
              <SelectCb value={by} label={t('bottompanel.agrupar')} current={GROUPS.find((g) => g.id === by)?.label()} onChange={(v) => s.set({ groupBy: v as GroupBy })}>
                {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label()}</option>)}
              </SelectCb>
            </>
          )}
          <SelectCb value={scope} label={t('pal.folhas_do_quantitativo')} current={scope === 'all' ? t('pal.todas_as_folhas') : t('bottompanel.esta_folha')} onChange={(v) => setScope(v as 'all' | 'page')}>
            <option value="all">{t('pal.todas_as_folhas')}</option>
            <option value="page">{t('bottompanel.esta_folha')}</option>
          </SelectCb>
          {tab === 'list' && (
            <SelectCb value={filter} label={t('bottompanel.todos_os_status')} current={filter || t('bottompanel.todos_os_status')} onChange={setFilter}>
              <option value="">{t('bottompanel.todos_os_status')}</option>
              {s.statuses.map((x) => <option key={x.name}>{x.name}</option>)}
            </SelectCb>
          )}
          <button type="button" className="tbn" disabled={!s.markups.length} onClick={async () => (await import('../../xlsxExport')).exportXlsx(s.fileName, s.markups.filter((m) => m.kind !== 'viewport'), s.presets, s.scales, s.sheets)}>
            <Icon name="planilha" size={16} />{t('bottompanel.planilha')}
          </button>
          <span className="sp" />
          {total > 0 && (
            <>
              <span className="tot"><span className="lb">{t('bottompanel.total_sem_bdi')}</span><b>R$ {fmt(total)}</b></span>
              {withBdi && <span className="tot"><span className="lb">{t('bottompanel.total_com_bdi', { v: fmt(s.bdi) })}</span><b>R$ {fmt(total * (1 + s.bdi / 100))}</b></span>}
            </>
          )}
          <button type="button" className="ib" aria-label={t('pal.fechar_a_paleta')} title={t('bottompanel.ocultar_quantitativo_ctrl_2')} onClick={() => s.set({ panels: { ...s.panels, bottom: false } })}><Glyph name="x" size={12} /></button>
        </header>
        <div className="qw">
          {tab === 'qty' ? (
            <table className="qt qt-wide">
              <colgroup><col style={{ width: 34 }} /><col style={{ width: 120 }} /><col style={{ width: 70 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 54 }} /><col style={{ width: 100 }} /><col style={{ width: 110 }} /><col style={{ width: 100 }} /><col style={{ width: 48 }} />{cols.map((c) => <col key={c.id} style={{ width: 96 }} />)}<col style={{ width: 110 }} /></colgroup>
              <thead>
                <tr>
                  <th scope="col" className="c0"></th><th scope="col">{t('bottompanel.grupo')}</th><th scope="col">{t('bottompanel.codigo')}</th><th scope="col">{t('bottompanel.servico')}</th><th scope="col">{t('bottompanel.folhas')}</th><th scope="col" className="num">{t('bottompanel.itens')}</th><th scope="col" className="num">{t('bottompanel.bruto')}</th><th scope="col">{t('pal.fator_formula')}</th><th scope="col" className="num">{t('bottompanel.quantidade')}</th><th scope="col">{t('pal.un')}</th>
                  {cols.map((c) => <th key={c.id} scope="col" className={c.type === 'text' ? '' : 'num'}>{c.name}</th>)}
                  <th scope="col" className="num">{t('bottompanel.total_r')}</th>
                </tr>
              </thead>
              <tbody>
                {sum.length === 0 && <tr><td colSpan={nCols} className="mut empty-row">{t('bottompanel.use_as_ferramentas_de_medicao')}</td></tr>}
                {buckets.map((b) => {
                  const rows = sum.filter((r) => r.bucket === b)
                  const sub = rows.reduce((a, r) => a + r.total, 0)
                  return (
                    <Fragment key={b || '_'}>
                      {by !== 'preset' && <tr className="gr"><th scope="row" colSpan={nCols - 1}>{b}</th><th scope="row" className="num">{sub ? `R$ ${fmt(sub)}` : ''}</th></tr>}
                      {rows.map((r) => {
                        const p = s.presets.find((x) => x.id === r.key.split('|')[1])
                        return (
                          <tr key={r.key}>
                            <td className="c0">{p ? <Sample p={p} /> : <i className="cz" style={{ background: r.color }} />}</td>
                            <td>{r.group}</td>
                            <td>{r.code}</td>
                            <td title={r.name}>{r.name}{r.unscaled ? <span className="warn-tx" title={t('bottompanel.itens_em_folhas_sem_escala')}> {t('bottompanel.sem_escala', { unscaled: r.unscaled })}</span> : null}</td>
                            <td>{r.sheets}</td>
                            <td className="num">{r.items}</td>
                            <td className="num">{fmt(r.raw)} {r.rawUnit}</td>
                            <td>{p?.formula || (r.factor !== 1 ? fmt(r.factor) : '—')}</td>
                            <td className="num q">{fmt(r.qty)}</td>
                            <td>{r.unit}</td>
                            {cols.map((c) => <td key={c.id} className={c.type === 'text' ? '' : 'num'}>{typeof r.fields[c.id] === 'number' ? fmt(r.fields[c.id] as number) : r.fields[c.id] ?? ''}</td>)}
                            <td className="num">{r.price ? fmt(r.total) : '—'}</td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="qt qt-wide">
              <colgroup><col style={{ width: 40 }} /><col style={{ width: 110 }} /><col style={{ width: 120 }} /><col /><col style={{ width: 110 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} /><col style={{ width: 150 }} /><col style={{ width: 100 }} /></colgroup>
              <thead>
                <tr><th scope="col" className="num">#</th><th scope="col">{t('bottompanel.folha')}</th><th scope="col">{t('bottompanel.tipo')}</th><th scope="col">{t('bottompanel.marcador_texto')}</th><th scope="col">{t('bottompanel.ambiente')}</th><th scope="col" className="num">{t('bottompanel.medida')}</th><th scope="col">{t('bottompanel.status')}</th><th scope="col">{t('bottompanel.comentario')}</th><th scope="col">{t('bottompanel.autor')}</th></tr>
              </thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={9} className="mut empty-row">{t('bottompanel.nenhuma_marcacao')}</td></tr>}
                {list.map((m) => {
                  const p = s.presets.find((x) => x.id === m.presetId)
                  const q = measureOf(m, scaleFor(m, s.markups, s.scales[m.page]), p)
                  const st = s.statuses.find((x) => x.name === m.status)
                  return (
                    <tr key={m.id} className={s.selected.includes(m.id) ? 'sel' : ''} tabIndex={0}
                      onClick={() => s.set({ page: Math.max(0, s.sheets.findIndex((x) => x.id === m.page)), selected: [m.id], tool: 'select', mode: 'review' })}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLElement).click() }}>
                      <td className="num">{s.markups.indexOf(m) + 1}</td>
                      <td>{s.sheets.find((x) => x.id === m.page)?.label}</td>
                      <td><i className="cz" style={{ background: m.color }} /> {KIND_LABEL[m.kind]}</td>
                      <td>{p?.name ?? (m.kind === 'image' ? '—' : m.text.split('\n')[0])}</td>
                      <td>{spaceOf(m, s.markups)?.text ?? ''}</td>
                      <td className="num">{q ? `${fmt(q.value)} ${q.unit}` : '—'}</td>
                      <td>{st && <i className="cz" style={{ background: st.color }} />} {m.status}</td>
                      <td title={m.comment}>{m.comment}</td>
                      <td>{m.author}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
