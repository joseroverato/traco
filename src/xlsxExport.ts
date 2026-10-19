import * as XLSX from 'xlsx'
import { measureOf, scaleFor } from './geometry'
import { summarize } from './summary'
import { download } from './project'
import { useStore } from './store'
import { spaceOf } from './columns'
import type { Markup, PageScale, Preset, Sheet } from './types'

export function exportXlsx(fileName: string, markups: Markup[], presets: Preset[], scales: Record<string, PageScale>, pages: Sheet[]) {
  const st = useStore.getState()
  const by = st.groupBy
  const cols = st.columns
  const sum = summarize(markups, presets, scales, pages, st.markups, by, cols)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const byLabel = { preset: '', space: 'Ambiente', level: 'Pavimento', sheet: 'Folha', status: 'Status' }[by]
  const q: Record<string, unknown>[] = sum.map((r) => ({
    ...(byLabel ? { [byLabel]: r.bucket } : {}),
    Grupo: r.group, Código: r.code, Serviço: r.name, Fórmula: presets.find((p) => p.id === r.key)?.formula || '', Folhas: r.sheets, Itens: r.items,
    'Medida bruta': r2(r.raw), 'Unid. bruta': r.rawUnit, Fator: r.factor, Quantidade: r2(r.qty), Unidade: r.unit,
    ...Object.fromEntries(cols.map((c) => [c.name, typeof r.fields[c.id] === 'number' ? r2(r.fields[c.id] as number) : r.fields[c.id] ?? ''])),
    'Preço unit. (R$)': r.price || '', 'Total (R$)': r.price ? r2(r.total) : '', 'Sem escala': r.unscaled || '',
  }))
  const total = sum.reduce((a, r) => a + r.total, 0)
  if (total > 0) {
    q.push({}, { Serviço: 'TOTAL SEM BDI', 'Total (R$)': r2(total) })
    if (st.bdi > 0) q.push({ Serviço: `BDI ${st.bdi}%`, 'Total (R$)': r2(total * st.bdi / 100) }, { Serviço: 'TOTAL COM BDI', 'Total (R$)': r2(total * (1 + st.bdi / 100)) })
  }
  const list = markups.map((m, i) => {
    const p = presets.find((x) => x.id === m.presetId)
    const mq = measureOf(m, scaleFor(m, markups, scales[m.page]), p)
    return {
      '#': i + 1, Folha: pages.find((pg) => pg.id === m.page)?.label ?? '', Pavimento: pages.find((pg) => pg.id === m.page)?.level ?? '', Ambiente: spaceOf(m, st.markups)?.text ?? '', Tipo: m.kind, Marcador: p?.name ?? '', Dedução: m.deduct ? 'sim' : '',
      Quantidade: mq ? r2(mq.value) : '', Unidade: mq?.unit ?? '', Status: m.status, Texto: m.text, Comentário: m.comment,
      Autor: m.author, Data: new Date(m.createdAt).toLocaleString('pt-BR'),
    }
  })
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(q)
  ws1['!cols'] = [...(byLabel ? [16] : []), 12, 12, 36, 12, 14, 7, 12, 8, 7, 12, 8, ...cols.map(() => 14), 14, 14, 10].map((w) => ({ wch: w }))
  const ws2 = XLSX.utils.json_to_sheet(list)
  ws2['!cols'] = [5, 12, 12, 16, 10, 30, 8, 11, 8, 11, 30, 40, 12, 18].map((w) => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws1, 'Quantitativo')
  XLSX.utils.book_append_sheet(wb, ws2, 'Marcações')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return download(out, `${fileName.replace(/\.pdf$/i, '') || 'traco'} - quantitativo.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
