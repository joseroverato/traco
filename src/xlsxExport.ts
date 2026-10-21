import * as XLSX from 'xlsx'
import { measureOf, scaleFor } from './geometry'
import { displayRows, summarize } from './summary'
import { download } from './project'
import { useStore } from './store'
import { spaceOf } from './columns'
import type { Markup, PageScale, Preset, Sheet } from './types'
import { fmtDateTime, t } from './i18n'
import { KIND_LABEL } from './kinds'

export function exportXlsx(fileName: string, markups: Markup[], presets: Preset[], scales: Record<string, PageScale>, pages: Sheet[]) {
  const st = useStore.getState()
  const by = st.groupBy
  const cols = st.columns
  const sum = displayRows(summarize(markups, presets, scales, pages, st.markups, by, cols))
  const r2 = (n: number) => Math.round(n * 100) / 100
  const byLabel = { preset: '', space: t('xlsx.ambiente'), level: t('xlsx.pavimento'), sheet: t('xlsx.folha'), status: t('xlsx.status') }[by]
  const service = t('xlsx.servico')
  const totalCol = t('xlsx.total')
  const q: Record<string, unknown>[] = sum.map((r) => ({
    ...(byLabel ? { [byLabel]: r.bucket } : {}),
    [t('xlsx.grupo')]: r.group, [t('xlsx.codigo')]: r.code, [service]: r.name, [t('xlsx.formula')]: presets.find((p) => p.id === r.key)?.formula || '', [t('xlsx.folhas')]: r.sheets, [t('xlsx.itens')]: r.items,
    [t('xlsx.medida_bruta')]: r2(r.raw), [t('xlsx.unid_bruta')]: r.rawUnit, [t('xlsx.fator')]: r.factor, [t('xlsx.quantidade')]: r2(r.qty), [t('xlsx.unidade')]: r.unit,
    ...Object.fromEntries(cols.map((c) => [c.name, typeof r.fields[c.id] === 'number' ? r2(r.fields[c.id] as number) : r.fields[c.id] ?? ''])),
    [t('xlsx.preco_unit')]: r.price || '', [totalCol]: r.price ? r2(r.total) : '', [t('xlsx.sem_escala')]: r.unscaled || '',
  }))
  const total = sum.reduce((a, r) => a + r.total, 0)
  if (total > 0) {
    q.push({}, { [service]: t('xlsx.total_sem_bdi'), [totalCol]: r2(total) })
    if (st.bdi > 0) q.push({ [service]: `${t('xlsx.bdi')} ${st.bdi}%`, [totalCol]: r2(total * st.bdi / 100) }, { [service]: t('xlsx.total_com_bdi'), [totalCol]: r2(total * (1 + st.bdi / 100)) })
  }
  const list = markups.map((m, i) => {
    const p = presets.find((x) => x.id === m.presetId)
    const mq = measureOf(m, scaleFor(m, markups, scales[m.page]), p)
    return {
      '#': i + 1, [t('xlsx.folha')]: pages.find((pg) => pg.id === m.page)?.label ?? '', [t('xlsx.pavimento')]: pages.find((pg) => pg.id === m.page)?.level ?? '', [t('xlsx.ambiente')]: spaceOf(m, st.markups)?.text ?? '', [t('xlsx.tipo')]: KIND_LABEL[m.kind] ?? m.kind, [t('xlsx.marcador')]: p?.name ?? '', [t('xlsx.deducao')]: m.deduct ? t('xlsx.sim') : '',
      [t('xlsx.quantidade')]: mq ? r2(mq.value) : '', [t('xlsx.unidade')]: mq?.unit ?? '', [t('xlsx.status')]: m.status, [t('xlsx.texto')]: m.text, [t('xlsx.comentario')]: m.comment,
      [t('xlsx.autor')]: m.author, [t('xlsx.data')]: fmtDateTime(m.createdAt),
    }
  })
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(q)
  ws1['!cols'] = [...(byLabel ? [16] : []), 12, 12, 36, 12, 14, 7, 12, 8, 7, 12, 8, ...cols.map(() => 14), 14, 14, 10].map((w) => ({ wch: w }))
  const ws2 = XLSX.utils.json_to_sheet(list)
  ws2['!cols'] = [5, 12, 12, 16, 10, 30, 8, 11, 8, 11, 30, 40, 12, 18].map((w) => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws1, t('xlsx.aba_quantitativo'))
  XLSX.utils.book_append_sheet(wb, ws2, t('xlsx.aba_marcacoes'))
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return download(out, `${fileName.replace(/\.pdf$/i, '') || 'traco'} - ${t('xlsx.sufixo_arquivo')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
