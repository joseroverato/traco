import type { Markup, Preset, Sheet } from './types'

/** Fábricas para os testes: objetos completos com valores neutros. */
export const mk = (o: Partial<Markup> = {}): Markup => ({
  id: 'm' + Math.random().toString(36).slice(2, 8),
  page: 's1',
  kind: 'length',
  points: [],
  text: '',
  comment: '',
  status: 'aberto',
  author: 'teste',
  createdAt: 0,
  presetId: null,
  deduct: false,
  color: '#e5484d',
  width: 1.5,
  fill: '#e5484d',
  fillOpacity: 0,
  fontSize: 12,
  ...o,
})

export const preset = (o: Partial<Preset> = {}): Preset => ({
  id: 'p1',
  name: 'Marcador',
  group: 'Civil',
  code: '',
  measure: 'length',
  color: '#3e63dd',
  opacity: 0.25,
  width: 1.5,
  dash: 'solid',
  pattern: 'solid',
  symbol: 'circle',
  letter: '',
  factor: 1,
  factorLabel: '',
  formula: '',
  resultUnit: 'm',
  unitPrice: 0,
  showLabel: true,
  ...o,
})

export const sheet = (o: Partial<Sheet> = {}): Sheet => ({
  id: 's1',
  src: 'a',
  srcIndex: 0,
  baseRot: 0,
  rot: 0,
  label: 'A-01',
  width: 1000,
  height: 1000,
  ...o,
})

/** Quadrado de lado `s` com canto em (x, y). */
export const square = (s: number, x = 0, y = 0) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s },
]
