export type Pt = { x: number; y: number }

export type Tool =
  | 'select'
  | 'pan'
  | 'rect'
  | 'ellipse'
  | 'cloud'
  | 'arrow'
  | 'line'
  | 'text'
  | 'stamp'
  | 'image'
  | 'length'
  | 'area'
  | 'count'
  | 'viewport'
  | 'redact'
  | 'space'
  | 'solid' // sólido 3D: base na planta + altura
  | 'legend'
  | 'calibrate'
  | 'fill' // área por clique (preenchimento dinâmico)
  | 'symbol' // contagem automática: selecionar um símbolo
  | 'hole' // desenhar vazio dentro da área selecionada
  | 'align' // alinhamento de sobreposição (interno)

export type MarkupKind = Exclude<Tool, 'select' | 'pan' | 'calibrate' | 'fill' | 'symbol' | 'hole' | 'align'>

export type Priority = 'baixa' | 'média' | 'alta'
export interface Reply {
  author: string
  at: number
  text: string
}

export type Pattern = 'solid' | 'hatch' | 'cross' | 'dots' | 'none'
export type Symbol = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' | 'letter'

/** Marcador de quantitativo personalizável (ex.: "Alvenaria bloco 14", "Ponto de tomada"). */
export interface Preset {
  id: string
  name: string
  group: string // disciplina / etapa: Civil, Elétrica, Hidráulica…
  code: string // código do orçamento (SINAPI, composição própria…)
  measure: 'length' | 'area' | 'count'
  color: string
  opacity: number // preenchimento 0..1
  width: number // espessura do traço (pt)
  dash: 'solid' | 'dash' | 'dot'
  pattern: Pattern
  symbol: Symbol
  letter: string
  /** Fator multiplicador H (ex.: pé-direito 2,80 transforma metro linear em m²). */
  factor: number
  factorLabel: string // ex.: "altura (m)"
  /** Fórmula opcional. Variáveis: L comprimento, A área, P perímetro, N contagem, H fator. */
  formula: string
  resultUnit: string // unidade final exibida/exportada (ex.: m², m, un)
  unitPrice: number // R$/unidade (opcional, 0 = não usar)
  showLabel: boolean
}

export interface PageScale {
  /** metros reais por unidade PDF (pt) */
  metersPerUnit: number
  label: string
}

export interface StatusDef {
  name: string
  color: string
}

export interface Markup {
  id: string
  /** id da folha (Sheet.id) — continua válido ao reordenar páginas */
  page: string
  kind: MarkupKind
  points: Pt[]
  text: string
  comment: string
  status: string
  author: string
  createdAt: number
  presetId: string | null
  /** Área de dedução (vãos) — subtrai do total do marcador. */
  deduct: boolean
  color: string
  width: number
  fill: string
  fillOpacity: number
  fontSize: number
  /** carimbo: rotação em graus e opacidade geral */
  angle?: number
  opacity?: number
  /** imagem (dataURL PNG/JPEG) */
  image?: string
  /** viewport: escala própria da região */
  scale?: PageScale
  /** área/ambiente: vazios (fosso, shaft, pilar) descontados da área */
  holes?: Pt[][]
  /** valores das colunas personalizadas (id da coluna → valor) */
  fields?: Record<string, string | number>
  /** compatibilização: nº do item, responsável, prioridade, prazo e respostas */
  issueNo?: number
  assignee?: string
  priority?: Priority
  due?: string
  replies?: Reply[]
  /** sólido 3D: cota da base e altura (m) */
  base?: number
  height?: number
  /** legenda de quantitativo */
  legend?: { scope: 'sheet' | 'all'; prices: boolean }
}

export interface CustomColumn {
  id: string
  name: string
  type: 'text' | 'number' | 'formula'
  /** fórmula com Q (quantidade), L, A, P, N, H e as colunas numéricas pelo nome */
  formula?: string
}

/** Disciplina sobreposta a uma folha (compatibilização). */
export interface Overlay {
  id: string
  src: string
  srcIndex: number
  rot: number
  label: string
  color: string
  opacity: number
  visible: boolean
  /** transforma coordenadas da folha sobreposta (pt) em coordenadas da folha base (pt) */
  matrix: [number, number, number, number, number, number]
}

export interface SinapiItem {
  code: string
  desc: string
  unit: string
  price: number
  kind: 'composição' | 'insumo' | 'própria'
}

/** Uma folha do conjunto: aponta para uma página de um PDF de origem. */
export interface Sheet {
  id: string
  src: string // Source.id
  srcIndex: number // 0-based
  baseRot: number // rotação original da página
  rot: number // rotação extra aplicada no Traço (0/90/180/270)
  label: string
  width: number // dimensões já rotacionadas, escala 1
  height: number
  level?: string // pavimento (Térreo, 1º pavimento…)
}

export interface OcrResult {
  text: string
  words: { text: string; x: number; y: number; w: number; h: number; conf: number }[] // em pt da folha
}
