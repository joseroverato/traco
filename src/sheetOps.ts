import { useStore } from './store'
import { t } from './i18n'
import type { Markup, Pt, Sheet } from './types'

/** Gira pontos da marcação junto com a folha. */
export function rotatePts(pts: Pt[], sh: Sheet, dir: 90 | -90): Pt[] {
  const W = sh.width, H = sh.height
  return pts.map((p) => (dir === 90 ? { x: H - p.y, y: p.x } : { x: p.y, y: W - p.x }))
}

/** Gira folhas (e suas marcações) 90° — usado no painel Editar PDF e no modo Organizar. */
export function rotateSheets(ids: string[], dir: 90 | -90) {
  const s = useStore.getState()
  const set = new Set(ids)
  const markups = s.markups.map((m): Markup => {
    const sh = s.sheets.find((x) => x.id === m.page)
    return sh && set.has(sh.id) ? { ...m, points: rotatePts(m.points, sh, dir), holes: m.holes?.map((h) => rotatePts(h, sh, dir)) } : m
  })
  s.setSheets(
    s.sheets.map((sh) => (set.has(sh.id) ? { ...sh, rot: (((sh.rot + dir) % 360) + 360) % 360, width: sh.height, height: sh.width } : sh)),
    { markups },
  )
}

/** Exclui uma folha (nunca a última; Ctrl+Z desfaz). */
export function deleteSheet(id: string) {
  const s = useStore.getState()
  if (s.sheets.length < 2 || !s.sheets.some((x) => x.id === id)) return s.notify(t('leftpanel.mantenha_ao_menos_uma_folha'), 'err')
  s.setSheets(s.sheets.filter((x) => x.id !== id))
  s.notify(t('leftpanel.folha_excluida_ctrl_z_desfaz'))
}
