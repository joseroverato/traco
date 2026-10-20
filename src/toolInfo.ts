/**
 * Texto e mini animação de cada ferramenta (dica ao pausar o mouse, no estilo do Revit).
 * Dados puros; o desenho fica em components/ToolDemo.tsx e components/DemoScenes.tsx. Para trocar uma
 * animação por um vídeo gravado, coloque `src/assets/tools/<id>.mp4` (ou .webm): ele passa a ser usado.
 *
 * Cada demo é uma pequena história de 5 s em laço, num cenário que combina com a ferramenta: o cursor
 * faz a ação, o resultado aparece e, às vezes, um segundo passo (digitar, puxar, alinhar).
 */
import type { Tool } from './types'
import { t } from './i18n'

export type Pt2 = [number, number]

/** Cenário de fundo da demonstração. */
export type Scene = 'rooms' | 'facade' | 'structure' | 'detail' | 'titleblock' | 'lighting' | 'grid'

/** Instantes (fração do ciclo, 0..1) em que a forma começa e termina de aparecer. */
interface Timing {
  t0?: number
  t1?: number
}

export type DemoShape = Timing &
  (
    /** traço desenhado aos poucos, na ordem dos pontos */
    | { t: 'path'; pts: Pt2[]; closed?: boolean; color?: string; fill?: number; dash?: boolean; w?: number; static?: boolean }
    | { t: 'cloud'; a: Pt2; b: Pt2; color?: string }
    | { t: 'ellipse'; c: Pt2; rx: number; ry: number; color?: string }
    /** marcas que aparecem em sequência, acompanhando o cursor */
    | { t: 'dots'; pts: Pt2[]; color?: string; r?: number; square?: boolean; numbered?: boolean }
    /** texto que aparece de uma vez; some em t1 se `fade` */
    | { t: 'label'; at: Pt2; text: string; color?: string; size?: number; fade?: boolean }
    /** texto digitado letra a letra */
    | { t: 'typing'; at: Pt2; text: string; color?: string; size?: number }
    /** barra que cresce da esquerda para a direita (tarja) */
    | { t: 'bar'; a: Pt2; b: Pt2; color?: string }
    /** caixa em perspectiva oblíqua que sobe (h) e depois é puxada (h2) */
    | { t: 'box'; x: number; y: number; w: number; d: number; h: number; h2?: number; t2?: [number, number]; color?: string }
    | { t: 'table'; at: Pt2; w: number; rows: number; color?: string }
    /** linhas de texto cinza */
    | { t: 'lines'; at: Pt2; w: number; n: number }
    /** janela de seleção tracejada que cresce; `keep` mantém depois de pronta */
    | { t: 'marquee'; a: Pt2; b: Pt2; color?: string; fill?: number; keep?: boolean }
    /** preenchimento que se espalha a partir do clique, recortado pelo polígono */
    | { t: 'flood'; from: Pt2; poly: Pt2[]; color?: string }
    /** carimbo/caixa que "cai" no lugar (escala + opacidade) */
    | { t: 'pop'; at: Pt2; w: number; h: number; text: string; sub?: string; color?: string; angle?: number }
    /** anel que se abre no ponto de um clique */
    | { t: 'click'; at: Pt2; color?: string }
    | { t: 'image'; a: Pt2; b: Pt2; color?: string }
  )

export interface DemoSpec {
  scene: Scene
  shapes: DemoShape[]
  /** caminho do cursor; se omitido, acompanha o primeiro traço */
  cursor?: Pt2[]
  /** instantes em que o cursor chega a cada ponto (mesmo tamanho de `cursor`) */
  cursorTimes?: number[]
  /** o cenário se desloca (mover vista) */
  panBy?: Pt2
  /** segunda camada (outra disciplina) que começa deslocada e se encaixa */
  ghost?: { color: string; dx: number; dy: number; t0: number; t1: number }
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
const V = '#0090ff' // azul claro (viewport)

const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
/** Ponta de seta em `to`, vinda de `from`. */
const head = (from: Pt2, to: Pt2, s = 7): Pt2[] => {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0])
  return [[to[0] - s * Math.cos(a - 0.5), to[1] - s * Math.sin(a - 0.5)], to, [to[0] - s * Math.cos(a + 0.5), to[1] - s * Math.sin(a + 0.5)]]
}

// ambientes da planta baixa (ver DemoScenes.tsx)
const ROOM_A = rect(12, 10, 96, 64) // sala (topo esquerdo)
const ROOM_B = rect(96, 10, 188, 64) // quarto (topo direito)

// luminárias do cenário de forro (4×3), a primeira é a selecionada
const LUM: Pt2[] = [34, 78, 122, 166].flatMap((x) => [34, 60, 86].map((y) => [x, y] as Pt2))

const BASE: Pt2[] = [[60, 96], [130, 96], [144.3, 84.3], [74.3, 84.3], [60, 96]] // base oblíqua do sólido
const SOCKETS: Pt2[] = [[22, 18], [86, 18], [44, 58], [124, 20], [176, 52], [150, 104], [26, 104]]
const ARROW_FROM: Pt2 = [132, 100]
const ARROW_TO: Pt2 = [58, 69]

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: {
    get title() { return t('toolinfo.selecionar') },
    get desc() { return t('toolinfo.clique_para_selecionar_e_arraste') },
    demo: {
      scene: 'structure',
      cursor: [[54, 12], [142, 72]],
      cursorTimes: [0.12, 0.5],
      shapes: [
        { t: 'marquee', a: [54, 12], b: [142, 72], color: A, t0: 0.12, t1: 0.5 },
        { t: 'dots', pts: [[80, 30], [130, 30], [80, 64], [130, 64]], color: A, r: 5.5, square: true, t0: 0.5, t1: 0.64 },
        { t: 'label', at: [105, 90], get text() { return t('toolinfo.4_itens_selecionados') }, color: A, size: 9, t0: 0.66 },
      ],
    },
  },
  pan: {
    get title() { return t('toolinfo.mover_vista') },
    get desc() { return t('toolinfo.arraste_para_deslocar_a_folha') },
    demo: {
      scene: 'facade',
      panBy: [-56, -16],
      cursor: [[132, 84], [76, 68]],
      cursorTimes: [0.12, 0.55],
      shapes: [{ t: 'label', at: [100, 112], get text() { return t('toolinfo.niveis_a_direita') }, color: A, size: 9, t0: 0.6 }],
    },
  },
  cloud: {
    get title() { return t('toolinfo.nuvem_de_revisao') },
    get desc() { return t('toolinfo.arraste_um_retangulo_para_circular') },
    demo: {
      scene: 'facade',
      cursor: [[38, 24], [120, 74]],
      cursorTimes: [0.12, 0.5],
      shapes: [{ t: 'cloud', a: [38, 24], b: [120, 74], color: R, t0: 0.12, t1: 0.5 }, { t: 'label', at: [79, 17], get text() { return t('toolinfo.rev_b_janelas') }, color: R, size: 9, t0: 0.58 }],
    },
  },
  rect: {
    get title() { return t('toolinfo.retangulo') },
    get desc() { return t('toolinfo.arraste_dois_cantos_use_para') },
    demo: {
      scene: 'detail',
      shapes: [{ t: 'path', pts: rect(120, 30, 188, 80), closed: true, color: R, fill: 0.12 }, { t: 'label', at: [154, 24], get text() { return t('toolinfo.conferir_cota') }, color: R, size: 9, t0: 0.62 }],
    },
  },
  ellipse: {
    get title() { return t('toolinfo.elipse') },
    get desc() { return t('toolinfo.arraste_para_circular_um_detalhe') },
    demo: {
      scene: 'facade',
      cursor: [[122, 76], [162, 106]],
      cursorTimes: [0.12, 0.5],
      shapes: [{ t: 'ellipse', c: [142, 91], rx: 21, ry: 13, color: R, t0: 0.12, t1: 0.5 }, { t: 'label', at: [142, 117], get text() { return t('toolinfo.detalhe_3') }, color: R, size: 9, t0: 0.58 }],
    },
  },
  arrow: {
    get title() { return t('toolinfo.seta') },
    get desc() { return t('toolinfo.arraste_do_inicio_ao_fim') },
    demo: {
      scene: 'rooms',
      cursor: [ARROW_FROM, ARROW_TO],
      cursorTimes: [0.32, 0.56],
      shapes: [
        { t: 'typing', at: [100, 110], get text() { return t('toolinfo.verificar_porta') }, color: R, size: 9, t0: 0.08, t1: 0.3 },
        { t: 'path', pts: [ARROW_FROM, ARROW_TO], color: R, w: 2, t0: 0.32, t1: 0.56 },
        { t: 'path', pts: head(ARROW_FROM, ARROW_TO), color: R, w: 2, t0: 0.56, t1: 0.62 },
      ],
    },
  },
  line: {
    get title() { return t('toolinfo.linha') },
    get desc() { return t('toolinfo.arraste_para_tracar_uma_linha') },
    demo: {
      scene: 'structure',
      shapes: [
        { t: 'path', pts: [[22, 47], [188, 47]], color: R, w: 2, t0: 0.12, t1: 0.55 },
        { t: 'label', at: [105, 41], get text() { return t('toolinfo.alinhar_eixo_2') }, color: R, size: 9, t0: 0.6 },
      ],
    },
  },
  text: {
    get title() { return t('toolinfo.texto') },
    get desc() { return t('toolinfo.clique_e_digite_uma_observacao') },
    demo: {
      scene: 'facade',
      cursor: [[126, 70], [60, 21]],
      cursorTimes: [0.08, 0.2],
      shapes: [
        { t: 'click', at: [60, 21], color: R, t0: 0.2 },
        { t: 'typing', at: [68, 21], get text() { return t('toolinfo.conferir_pe_direito') }, color: R, size: 10, t0: 0.24, t1: 0.6 },
        { t: 'path', pts: [[72, 25], [72, 52]], color: R, w: 1.2, t0: 0.62, t1: 0.7 },
      ],
    },
  },
  stamp: {
    get title() { return t('toolinfo.carimbo') },
    get desc() { return t('toolinfo.clique_para_colocar_um_carimbo') },
    demo: {
      scene: 'titleblock',
      cursor: [[100, 66], [150, 38]],
      cursorTimes: [0.12, 0.34],
      shapes: [{ t: 'click', at: [150, 38], color: R, t0: 0.34 }, { t: 'pop', at: [150, 38], w: 66, h: 30, get text() { return t('toolinfo.revisado') }, sub: '19/10/2026', color: R, angle: -8, t0: 0.36 }],
    },
  },
  image: {
    get title() { return t('toolinfo.imagem_assinatura') },
    get desc() { return t('toolinfo.escolha_uma_imagem_logo_assinatura') },
    demo: {
      scene: 'titleblock',
      cursor: [[120, 56], [34, 94]],
      cursorTimes: [0.12, 0.36],
      shapes: [{ t: 'click', at: [34, 94], color: A, t0: 0.36 }, { t: 'image', a: [14, 80], b: [54, 108], color: A, t0: 0.4, t1: 0.52 }],
    },
  },
  redact: {
    get title() { return t('toolinfo.tarja_corrigir_texto') },
    get desc() { return t('toolinfo.cubra_o_que_deve_ser') },
    demo: {
      scene: 'titleblock',
      cursor: [[108, 22], [184, 22], [108, 36], [160, 36]],
      cursorTimes: [0.12, 0.3, 0.38, 0.52],
      shapes: [
        { t: 'lines', at: [110, 14], w: 72, n: 5 },
        { t: 'bar', a: [108, 19], b: [184, 26], color: '#000', t0: 0.12, t1: 0.3 },
        { t: 'bar', a: [108, 33], b: [160, 40], color: '#000', t0: 0.38, t1: 0.52 },
        { t: 'label', at: [146, 56], get text() { return t('toolinfo.removido_do_pdf') }, color: '#9aa1b2', size: 9, t0: 0.6 },
      ],
    },
  },
  calibrate: {
    get title() { return t('toolinfo.calibrar_escala') },
    get desc() { return t('toolinfo.trace_sobre_uma_cota_conhecida') },
    demo: {
      scene: 'structure',
      cursor: [[80, 108], [130, 108]],
      cursorTimes: [0.12, 0.42],
      shapes: [
        { t: 'path', pts: [[80, 108], [130, 108]], color: A, w: 2.4, t0: 0.12, t1: 0.42 },
        { t: 'pop', at: [105, 80], w: 84, h: 26, get text() { return t('toolinfo.valor_real') }, sub: '5,00 m', color: A, t0: 0.5 },
        { t: 'label', at: [150, 22], get text() { return t('toolinfo.escala_1_50') }, color: A, size: 10, t0: 0.78 },
      ],
    },
  },
  length: {
    get title() { return t('toolinfo.comprimento') },
    get desc() { return t('toolinfo.clique_os_pontos_e_enter') },
    demo: {
      scene: 'rooms',
      shapes: [
        { t: 'path', pts: [[20, 102], [104, 102], [104, 74]], color: G, w: 2.6, t0: 0.12, t1: 0.58 },
        { t: 'label', at: [62, 96], text: '8,4 m', color: G, size: 9, t0: 0.4, t1: 0.58, fade: true },
        { t: 'label', at: [62, 88], get text() { return t('toolinfo.total_11_3_m') }, color: G, size: 10, t0: 0.62 },
      ],
    },
  },
  area: {
    get title() { return t('toolinfo.area') },
    get desc() { return t('toolinfo.clique_os_vertices_do_poligono') },
    demo: {
      scene: 'rooms',
      shapes: [
        { t: 'path', pts: rect(114, 68, 184, 106), closed: true, color: G, fill: 0.26, t0: 0.12, t1: 0.55 },
        { t: 'label', at: [149, 86], text: '13,6 m²', color: G, size: 11, t0: 0.6 },
        { t: 'label', at: [149, 97], get text() { return t('toolinfo.perim_14_2_m') }, color: G, size: 8, t0: 0.66 },
      ],
    },
  },
  fill: {
    get title() { return t('toolinfo.area_por_clique') },
    get desc() { return t('toolinfo.clique_dentro_de_um_ambiente') },
    demo: {
      scene: 'rooms',
      cursor: [[176, 100], [142, 36]],
      cursorTimes: [0.08, 0.2],
      shapes: [
        { t: 'click', at: [142, 36], color: G, t0: 0.2 },
        { t: 'flood', from: [142, 36], poly: ROOM_B, color: G, t0: 0.22, t1: 0.5 },
        { t: 'label', at: [142, 40], text: '27,5 m²', color: G, size: 11, t0: 0.55 },
      ],
    },
  },
  hole: {
    get title() { return t('toolinfo.vazio') },
    get desc() { return t('toolinfo.desenhe_dentro_de_uma_area') },
    demo: {
      scene: 'rooms',
      shapes: [
        { t: 'path', pts: ROOM_A, closed: true, color: G, fill: 0.22, static: true },
        { t: 'label', at: [40, 50], text: '26,0 m²', color: G, size: 10, t0: 0.02, t1: 0.56, fade: true },
        { t: 'path', pts: rect(62, 16, 88, 40), closed: true, color: R, fill: 0.4, w: 1.8, t0: 0.14, t1: 0.46 },
        { t: 'label', at: [40, 50], text: '23,4 m²', color: G, size: 10, t0: 0.6 },
      ],
    },
  },
  count: {
    get title() { return t('toolinfo.contagem') },
    get desc() { return t('toolinfo.clique_em_cada_item_para') },
    demo: {
      scene: 'rooms',
      cursor: SOCKETS,
      shapes: [
        { t: 'dots', pts: SOCKETS, color: O, r: 5, numbered: true, t0: 0.1, t1: 0.62 },
        { t: 'label', at: [150, 40], text: '7 un', color: O, size: 12, t0: 0.68 },
      ],
    },
  },
  symbol: {
    get title() { return t('toolinfo.contagem_automatica') },
    get desc() { return t('toolinfo.arraste_um_retangulo_em_volta') },
    demo: {
      scene: 'lighting',
      cursor: [[24, 24], [44, 44]],
      cursorTimes: [0.1, 0.28],
      shapes: [
        { t: 'marquee', a: [24, 24], b: [44, 44], color: O, keep: true, t0: 0.1, t1: 0.28 },
        { t: 'dots', pts: LUM.slice(1), color: O, r: 7.5, square: true, t0: 0.34, t1: 0.78 },
        { t: 'label', at: [100, 116], get text() { return t('toolinfo.12_iguais_2_tomadas_ignoradas') }, color: O, size: 9, t0: 0.8 },
      ],
    },
  },
  space: {
    get title() { return t('toolinfo.ambiente') },
    get desc() { return t('toolinfo.desenhe_o_contorno_de_um') },
    demo: {
      scene: 'rooms',
      cursor: [...rect(14, 66, 108, 108), [14, 66]],
      shapes: [
        { t: 'path', pts: rect(14, 66, 108, 108), closed: true, color: P, fill: 0.14, dash: true, t0: 0.12, t1: 0.5 },
        { t: 'typing', at: [36, 84], get text() { return t('toolinfo.cozinha') }, color: P, size: 11, t0: 0.5, t1: 0.66 },
        { t: 'label', at: [61, 97], text: '28,4 m²', color: P, size: 9, t0: 0.7 },
      ],
    },
  },
  solid: {
    get title() { return t('toolinfo.solido_3d') },
    get desc() { return t('toolinfo.desenhe_a_base_na_planta') },
    demo: {
      scene: 'grid',
      cursor: [...BASE, [102, 62], [102, 40]],
      cursorTimes: [0.1, 0.17, 0.23, 0.29, 0.33, 0.5, 0.8],
      shapes: [
        { t: 'box', x: 60, y: 96, w: 70, d: 26, h: 30, h2: 50, t0: 0.34, t1: 0.48, t2: [0.54, 0.8], color: T },
        { t: 'label', at: [158, 28], text: 'h = 2,80 m', color: T, size: 10, t0: 0.5, t1: 0.56, fade: true },
        { t: 'label', at: [158, 28], text: 'h = 4,20 m', color: T, size: 10, t0: 0.82 },
      ],
    },
  },
  viewport: {
    get title() { return t('toolinfo.viewport_escala_propria') },
    get desc() { return t('toolinfo.marque_a_regiao_de_um') },
    demo: {
      scene: 'structure',
      cursor: [[8, 60], [114, 112]],
      cursorTimes: [0.12, 0.5],
      shapes: [{ t: 'marquee', a: [8, 60], b: [114, 112], color: V, fill: 0.08, keep: true, t0: 0.12, t1: 0.5 }, { t: 'label', at: [62, 80], text: '1:20', color: V, size: 16, t0: 0.58 }],
    },
  },
  legend: {
    get title() { return t('toolinfo.legenda_de_quantitativo') },
    get desc() { return t('toolinfo.clique_onde_a_tabela_de') },
    demo: {
      scene: 'rooms',
      cursor: [[150, 100], [114, 16]],
      cursorTimes: [0.1, 0.32],
      shapes: [{ t: 'click', at: [114, 16], color: A, t0: 0.32 }, { t: 'table', at: [114, 16], w: 74, rows: 4, color: A, t0: 0.36 }],
    },
  },
  align: {
    get title() { return t('toolinfo.alinhar_sobreposicao') },
    get desc() { return t('toolinfo.clique_dois_pares_de_pontos') },
    demo: {
      scene: 'structure',
      cursor: [[92, 38], [80, 30], [142, 72], [130, 64]],
      cursorTimes: [0.1, 0.2, 0.32, 0.42],
      ghost: { color: O, dx: 12, dy: 8, t0: 0.54, t1: 0.74 },
      shapes: [
        { t: 'dots', pts: [[92, 38]], color: O, r: 4, t0: 0.1, t1: 0.14 },
        { t: 'dots', pts: [[80, 30]], color: A, r: 4, t0: 0.2, t1: 0.24 },
        { t: 'dots', pts: [[142, 72]], color: O, r: 4, t0: 0.32, t1: 0.36 },
        { t: 'dots', pts: [[130, 64]], color: A, r: 4, t0: 0.42, t1: 0.46 },
        { t: 'label', at: [105, 94], get text() { return t('toolinfo.disciplinas_alinhadas') }, color: O, size: 9, t0: 0.8 },
      ],
    },
  },
}
