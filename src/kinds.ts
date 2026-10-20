import type { Markup } from './types'
import { t, tPdf } from './i18n'

export const KIND_LABEL: Record<Markup['kind'], string> = {
  get rect() { return t('kinds.retangulo') }, get ellipse() { return t('kinds.elipse') }, get cloud() { return t('kinds.nuvem') }, get arrow() { return t('kinds.seta') }, get line() { return t('kinds.linha') }, get text() { return t('kinds.texto') },
  get length() { return t('kinds.comprimento') }, get area() { return t('kinds.area') }, get count() { return t('kinds.contagem') }, get stamp() { return t('kinds.carimbo') }, get image() { return t('kinds.imagem') }, get viewport() { return t('kinds.viewport') }, get redact() { return t('kinds.tarja_correcao') }, get space() { return t('kinds.ambiente') }, get solid() { return t('kinds.solido_3d') }, get legend() { return t('kinds.legenda') },
}

/** Prioridade de um item de compatibilização. O valor guardado no projeto é sempre o português (baixa | média | alta); aqui só se traduz para exibir. */
export const PRIORITIES = ['baixa', 'média', 'alta'] as const
export function priorityLabel(p: string, pdf = false): string {
  const k = p === 'baixa' ? 'priority.baixa' : p === 'média' ? 'priority.media' : p === 'alta' ? 'priority.alta' : null
  return k ? (pdf ? tPdf(k) : t(k)) : p
}
