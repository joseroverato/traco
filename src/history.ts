/** Quantos passos de desfazer ficam guardados. */
export const MAX_HISTORY = 80

/** Acrescenta um estado ao histórico, descartando os mais antigos acima do limite. */
export const pushHistory = <T>(past: T[], snap: T, max = MAX_HISTORY): T[] => {
  const next = [...past, snap]
  return next.length > max ? next.slice(next.length - max) : next
}
