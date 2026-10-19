/** Itens de compatibilização/revisão: numeração, filtros e relatório (PDF e Excel). */
import { useStore } from './store'
import type { Markup } from './types'

export const ISSUE_KINDS: Markup['kind'][] = ['cloud', 'rect', 'ellipse', 'arrow', 'text', 'line']
export const isIssue = (m: Markup) => ISSUE_KINDS.includes(m.kind)

/** Lista de itens na ordem de criação, com número estável (issueNo) ou sequencial. */
export function issueList(markups: Markup[]) {
  const list = markups.filter(isIssue).sort((a, b) => a.createdAt - b.createdAt)
  let next = Math.max(0, ...list.map((m) => m.issueNo ?? 0)) + 1
  return list.map((m) => ({ m, no: m.issueNo ?? next++ }))
}

/** Grava números definitivos em todos os itens (para o relatório bater com a prancha). */
export function renumber() {
  const s = useStore.getState()
  const nums = new Map(issueList(s.markups).map((x, i) => [x.m.id, i + 1]))
  s.checkpoint()
  useStore.setState({ markups: s.markups.map((m) => (nums.has(m.id) ? { ...m, issueNo: nums.get(m.id) } : m)) })
}


export interface ReportFilter {
  status?: string
  assignee?: string
  sheet?: string
}

export function filtered(f: ReportFilter) {
  return issueList(useStore.getState().markups).filter(({ m }) => (!f.status || m.status === f.status) && (!f.assignee || (m.assignee ?? '') === f.assignee) && (!f.sheet || m.page === f.sheet))
}

