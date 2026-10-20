import type { Markup } from './types'

export const KIND_LABEL: Record<Markup['kind'], string> = {
  rect: 'Retângulo', ellipse: 'Elipse', cloud: 'Nuvem', arrow: 'Seta', line: 'Linha', text: 'Texto',
  length: 'Comprimento', area: 'Área', count: 'Contagem', stamp: 'Carimbo', image: 'Imagem', viewport: 'Viewport', redact: 'Tarja / correção', space: 'Ambiente', solid: 'Sólido 3D', legend: 'Legenda',
}
