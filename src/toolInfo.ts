/**
 * Texto e mini animação de cada ferramenta (dica ao pausar o mouse, no estilo do Revit).
 * Dados puros; o desenho fica em components/ToolDemo.tsx. Para trocar uma animação por um vídeo gravado,
 * coloque `src/assets/tools/<id>.mp4` (ou .webm): ele passa a ser usado no lugar da animação.
 */
import type { Tool } from './types'

export type Pt2 = [number, number]

export type DemoShape =
  /** traço desenhado aos poucos, na ordem dos pontos (o cursor acompanha) */
  | { t: 'path'; pts: Pt2[]; closed?: boolean; color?: string; fill?: number; dash?: boolean; w?: number; static?: boolean }
  | { t: 'cloud'; a: Pt2; b: Pt2; color?: string }
  | { t: 'ellipse'; c: Pt2; rx: number; ry: number; color?: string }
  /** pontos/marcas que aparecem em sequência */
  | { t: 'dots'; pts: Pt2[]; color?: string; r?: number; square?: boolean; numbered?: boolean }
  | { t: 'label'; at: Pt2; text: string; color?: string; size?: number }
  /** barra que cresce da esquerda para a direita (tarja) */
  | { t: 'bar'; a: Pt2; b: Pt2; color?: string }
  /** caixa que sobe em perspectiva oblíqua (sólido 3D) */
  | { t: 'box'; x: number; y: number; w: number; d: number; h: number; color?: string }
  | { t: 'table'; at: Pt2; w: number; rows: number; color?: string }
  /** linhas de texto cinza (fundo) */
  | { t: 'lines'; at: Pt2; w: number; n: number }

export interface DemoSpec {
  shapes: DemoShape[]
  /** caminho do cursor; se omitido, acompanha o primeiro traço */
  cursor?: Pt2[]
  /** o desenho de fundo se desloca (mover vista) */
  panBy?: Pt2
  /** fundo: planta com 3 ambientes (padrão) ou nenhum */
  plan?: boolean
}

export interface ToolInfo {
  title: string
  desc: string
  demo: DemoSpec
}

export const DEMO_W = 200
export const DEMO_H = 120

const A = '#3e63dd' // azul (ação)
const R = '#e5484d' // vermelho (revisão)
const G = '#30a46c' // verde (medição)
const P = '#8e4ec6' // roxo (ambiente)
const O = '#f76b15' // laranja (contagem)
const T = '#2f9e8f' // verde-água (sólido)

const ROOM_A: Pt2[] = [[10, 10], [100, 10], [100, 70], [10, 70]]
const ROOM_B: Pt2[] = [[100, 10], [190, 10], [190, 70], [100, 70]]

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: {
    title: 'Selecionar',
    desc: 'Clique para selecionar e arraste para mover. Arraste na área vazia para marcar vários; Shift soma à seleção.',
    demo: {
      cursor: [[150, 100], [60, 42]],
      shapes: [
        { t: 'path', pts: [[30, 25], [90, 25], [90, 58], [30, 58]], closed: true, color: R, static: true },
        { t: 'dots', pts: [[30, 25], [90, 25], [90, 58], [30, 58]], color: A, r: 3, square: true },
      ],
    },
  },
  pan: {
    title: 'Mover vista',
    desc: 'Arraste para deslocar a folha. Também funciona segurando a barra de espaço ou com o botão do meio do mouse.',
    demo: { panBy: [-34, -16], cursor: [[120, 80], [86, 64]], shapes: [] },
  },
  cloud: {
    title: 'Nuvem de revisão',
    desc: 'Arraste um retângulo para circular o que precisa de atenção. Vira um item da lista de revisão, com responsável e prazo.',
    demo: { cursor: [[112, 22], [172, 56]], shapes: [{ t: 'cloud', a: [112, 22], b: [172, 56], color: R }, { t: 'label', at: [142, 70], text: 'revisar', color: R }] },
  },
  rect: {
    title: 'Retângulo',
    desc: 'Arraste dois cantos. Use para destacar uma região ou criar um item de revisão.',
    demo: { shapes: [{ t: 'path', pts: [[112, 22], [172, 22], [172, 56], [112, 56]], closed: true, color: R, fill: 0.12 }] },
  },
  ellipse: {
    title: 'Elipse',
    desc: 'Arraste para circular um detalhe, como um ponto de atenção na prancha.',
    demo: { cursor: [[112, 24], [172, 56]], shapes: [{ t: 'ellipse', c: [142, 40], rx: 30, ry: 17, color: R }] },
  },
  arrow: {
    title: 'Seta',
    desc: 'Arraste do início ao fim. Com Shift trava em 0°, 45° ou 90°. Aponta o que o comentário se refere.',
    demo: { shapes: [{ t: 'path', pts: [[112, 70], [160, 30]], color: R, w: 2 }, { t: 'path', pts: [[146, 32], [160, 30], [154, 44]], color: R, w: 2 }] },
  },
  line: {
    title: 'Linha',
    desc: 'Arraste para traçar uma linha de anotação. Shift trava o ângulo.',
    demo: { shapes: [{ t: 'path', pts: [[112, 66], [176, 30]], color: R, w: 2 }] },
  },
  text: {
    title: 'Texto',
    desc: 'Clique e digite uma observação direto sobre a folha. Duplo clique edita depois.',
    demo: { cursor: [[120, 70], [118, 40]], shapes: [{ t: 'label', at: [150, 42], text: 'Conferir cota', color: R, size: 11 }] },
  },
  stamp: {
    title: 'Carimbo',
    desc: 'Clique para colocar um carimbo (ex.: REVISADO e a data). Aceita {data}, {folha}, {n}, {total} e {autor}.',
    demo: {
      cursor: [[130, 90], [140, 44]],
      shapes: [
        { t: 'path', pts: [[104, 28], [180, 28], [180, 58], [104, 58]], closed: true, color: R, w: 2, static: true },
        { t: 'label', at: [142, 40], text: 'REVISADO', color: R, size: 10 },
        { t: 'label', at: [142, 52], text: '19/10/2026', color: R, size: 8 },
      ],
    },
  },
  image: {
    title: 'Imagem / assinatura',
    desc: 'Escolha uma imagem (logo, assinatura, foto) e clique onde ela deve ficar.',
    demo: {
      cursor: [[120, 90], [124, 36]],
      shapes: [
        { t: 'path', pts: [[110, 22], [170, 22], [170, 62], [110, 62]], closed: true, color: A, fill: 0.1 },
        { t: 'path', pts: [[116, 58], [134, 38], [146, 50], [154, 42], [166, 58]], color: A, w: 1.6 },
      ],
    },
  },
  redact: {
    title: 'Tarja / corrigir texto',
    desc: 'Cubra o que deve ser removido. No app de PC, ao exportar o texto e a imagem sob a tarja somem de verdade; o desenho vetorial é preservado.',
    demo: {
      cursor: [[26, 44], [128, 44]],
      shapes: [{ t: 'lines', at: [26, 30], w: 110, n: 4 }, { t: 'bar', a: [26, 38], b: [128, 52], color: '#000' }],
    },
  },
  calibrate: {
    title: 'Calibrar escala',
    desc: 'Trace sobre uma cota conhecida e digite o valor real para acertar a escala da folha (ou do viewport).',
    demo: {
      shapes: [
        { t: 'path', pts: [[24, 96], [110, 96]], color: A, w: 2 },
        { t: 'path', pts: [[24, 90], [24, 102]], color: A, w: 2, static: true },
        { t: 'path', pts: [[110, 90], [110, 102]], color: A, w: 2, static: true },
        { t: 'label', at: [67, 88], text: '5,00 m', color: A, size: 11 },
      ],
    },
  },
  length: {
    title: 'Comprimento',
    desc: 'Clique os pontos e Enter (ou duplo clique) para finalizar. Mede na escala da folha; com um marcador vira m, m² ou fórmula.',
    demo: { shapes: [{ t: 'path', pts: [[20, 100], [100, 100], [100, 78]], color: G, w: 2.4 }, { t: 'label', at: [60, 92], text: '9,80 m', color: G, size: 11 }] },
  },
  area: {
    title: 'Área',
    desc: 'Clique os vértices do polígono; clicar no primeiro ponto ou Enter fecha. Mostra m² e perímetro.',
    demo: { shapes: [{ t: 'path', pts: [[20, 80], [100, 80], [100, 106], [20, 106]], closed: true, color: G, fill: 0.22 }, { t: 'label', at: [60, 96], text: '24,3 m²', color: G, size: 11 }] },
  },
  fill: {
    title: 'Área por clique',
    desc: 'Clique dentro de um ambiente: o contorno sai das linhas do PDF e fosso ou shaft fechados já saem descontados. Shift+clique desconta um vazio.',
    demo: {
      cursor: [[150, 96], [55, 40]],
      shapes: [{ t: 'path', pts: ROOM_A, closed: true, color: G, fill: 0.28, static: true }, { t: 'label', at: [55, 44], text: '27,5 m²', color: G, size: 11 }],
    },
  },
  hole: {
    title: 'Vazio',
    desc: 'Desenhe dentro de uma área para descontar fosso, shaft ou pilar. O m² é recalculado.',
    demo: {
      shapes: [
        { t: 'path', pts: ROOM_B, closed: true, color: G, fill: 0.2, static: true },
        { t: 'path', pts: [[130, 26], [160, 26], [160, 52], [130, 52]], closed: true, color: R, fill: 0.35, w: 1.6 },
      ],
    },
  },
  count: {
    title: 'Contagem',
    desc: 'Clique em cada item para somar. Esc inicia um novo grupo; duplo clique numa marca a remove.',
    demo: {
      cursor: [[118, 24], [150, 30], [172, 44], [130, 52], [160, 60]],
      shapes: [{ t: 'dots', pts: [[118, 24], [150, 30], [172, 44], [130, 52], [160, 60]], color: O, r: 5, numbered: true }, { t: 'label', at: [168, 22], text: '5 un', color: O, size: 11 }],
    },
  },
  symbol: {
    title: 'Contagem automática',
    desc: 'Arraste um retângulo em volta de UM símbolo: o Traço acha os iguais, inclusive girados, nesta folha ou em todas.',
    demo: {
      cursor: [[24, 26], [44, 46]],
      shapes: [
        { t: 'dots', pts: [[34, 36], [120, 30], [150, 56], [70, 58]], color: '#667', r: 4, numbered: false },
        { t: 'path', pts: [[26, 28], [42, 28], [42, 44], [26, 44]], closed: true, color: O, dash: true },
        { t: 'dots', pts: [[120, 30], [150, 56], [70, 58]], color: O, r: 7, square: true },
        { t: 'label', at: [150, 22], text: '4 iguais', color: O, size: 11 },
      ],
    },
  },
  space: {
    title: 'Ambiente',
    desc: 'Desenhe o contorno de um ambiente. As medições dentro dele são agrupadas por ambiente no quantitativo.',
    demo: { shapes: [{ t: 'path', pts: ROOM_B, closed: true, color: P, fill: 0.14, dash: true }, { t: 'label', at: [145, 38], text: 'Sala', color: P, size: 11 }, { t: 'label', at: [145, 52], text: '18,0 m²', color: P, size: 9 }] },
  },
  solid: {
    title: 'Sólido 3D',
    desc: 'Desenhe a base na planta (Enter finaliza). A altura se ajusta nas propriedades ou puxando a seta no modo 3D, e o volume entra no quantitativo.',
    demo: { cursor: [[112, 78], [170, 78], [170, 98], [112, 98]], shapes: [{ t: 'box', x: 112, y: 98, w: 58, d: 20, h: 36, color: T }, { t: 'label', at: [148, 36], text: 'h = 2,80 m', color: T, size: 11 }] },
  },
  viewport: {
    title: 'Viewport (escala própria)',
    desc: 'Marque a região de um detalhe que tem outra escala (ex.: 1:20). As medições que começam dentro dela usam essa escala.',
    demo: { shapes: [{ t: 'path', pts: [[104, 20], [182, 20], [182, 62], [104, 62]], closed: true, color: '#0090ff', fill: 0.08, dash: true }, { t: 'label', at: [143, 44], text: '1:20', color: '#0090ff', size: 12 }] },
  },
  legend: {
    title: 'Legenda de quantitativo',
    desc: 'Clique onde a tabela de quantitativo deve ficar na prancha. Ela sai no PDF exportado.',
    demo: { cursor: [[120, 90], [112, 30]], shapes: [{ t: 'table', at: [104, 22], w: 78, rows: 4, color: A }] },
  },
  align: {
    title: 'Alinhar sobreposição',
    desc: 'Clique dois pares de pontos (no desenho colorido e na base) para encaixar a outra disciplina sobre a planta.',
    demo: { cursor: [[40, 50], [140, 54]], shapes: [{ t: 'dots', pts: [[40, 50], [140, 54]], color: O, r: 5 }, { t: 'path', pts: [[40, 50], [140, 54]], color: O, dash: true, w: 1.4 }] },
  },
}
