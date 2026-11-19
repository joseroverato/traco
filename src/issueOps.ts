/** Compatibilização: filtro da lista e comandos de relatório, usados pela paleta e pelos botões da faixa. */
import { curSheet, useStore } from './store'
import type { State } from './store'
import { isIssue, issueList, renumber } from './issues'
import type { ReportFilter } from './issues'
import { t } from './i18n'

/** Filtro de relatório que corresponde aos controles da paleta Compatibilização. */
export const reportFilter = (s: Pick<State, 'issueFilter' | 'sheets' | 'page'>): ReportFilter => ({
  status: s.issueFilter.status || undefined,
  assignee: s.issueFilter.assignee || undefined,
  sheet: s.issueFilter.onlyCur ? curSheet(s)?.id : undefined,
})

/** Itens (numerados) que passam pelo filtro. */
export const visibleIssues = (s: Pick<State, 'markups' | 'issueFilter' | 'sheets' | 'page'>) => {
  const f = reportFilter(s)
  return issueList(s.markups).filter(({ m }) => (!f.status || m.status === f.status) && (!f.assignee || (m.assignee ?? '') === f.assignee) && (!f.sheet || m.page === f.sheet))
}

export const hasIssues = (s: Pick<State, 'markups'>) => s.markups.some(isIssue)

/** Há item que passa pelo filtro da paleta? (sem ordenar: serve aos botões da faixa, que redesenham a cada mudança) */
export function hasVisibleIssues(s: Pick<State, 'markups' | 'issueFilter' | 'sheets' | 'page'>): boolean {
  const f = reportFilter(s)
  return s.markups.some((m) => isIssue(m) && (!f.status || m.status === f.status) && (!f.assignee || (m.assignee ?? '') === f.assignee) && (!f.sheet || m.page === f.sheet))
}

// o filtro é da sessão de trabalho num documento: ao trocar de aba de documento ele volta a mostrar tudo
useStore.subscribe((s, prev) => {
  if (s.activeTab !== prev.activeTab && (s.issueFilter.status || s.issueFilter.assignee || s.issueFilter.onlyCur)) useStore.setState({ issueFilter: { status: '', assignee: '', onlyCur: false } })
})

export function setIssueFilter(patch: Partial<State['issueFilter']>) {
  const s = useStore.getState()
  s.set({ issueFilter: { ...s.issueFilter, ...patch } })
}

async function withBusy(fn: () => Promise<unknown>) {
  const s = useStore.getState()
  if (s.issuesBusy) return
  s.set({ issuesBusy: t('issuespanel.gerando') })
  try { await fn() } finally { useStore.getState().set({ issuesBusy: '' }) }
}

export const exportIssuesPdf = () => withBusy(async () => (await import('./issuesReport')).issuesPdf(reportFilter(useStore.getState()), (m) => useStore.getState().set({ issuesBusy: m })))
export const exportIssuesXlsx = () => withBusy(async () => (await import('./issuesReport')).issuesXlsx(reportFilter(useStore.getState())))
export function renumberIssues() {
  renumber()
  useStore.getState().notify(t('issuespanel.itens_numerados_de_1_em'))
}
