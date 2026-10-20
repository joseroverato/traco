import { Box, Building2, PaintBucket, ScanSearch, SquareDashed, Eraser, ArrowUpRight, Circle, Cloud, Frame, Hand, ImagePlus, Minus, MousePointer2, Pentagon, Ruler, Scaling, Square, Stamp, Target, Type } from 'lucide-react'
import type { Tool } from './types'
import { t } from './i18n'

export const TOOLS: { id: Tool; icon: typeof Square; label: string; key: string; group: number }[] = [
  { id: 'select', icon: MousePointer2, get label() { return t('railtools.selecionar') }, key: 'V', group: 0 },
  { id: 'pan', icon: Hand, get label() { return t('railtools.mover_vista') }, key: 'H', group: 0 },
  { id: 'cloud', icon: Cloud, get label() { return t('railtools.nuvem_de_revisao') }, key: 'C', group: 1 },
  { id: 'rect', icon: Square, get label() { return t('railtools.retangulo') }, key: 'R', group: 1 },
  { id: 'ellipse', icon: Circle, get label() { return t('railtools.elipse') }, key: 'E', group: 1 },
  { id: 'arrow', icon: ArrowUpRight, get label() { return t('railtools.seta') }, key: 'A', group: 1 },
  { id: 'line', icon: Minus, get label() { return t('railtools.linha') }, key: 'I', group: 1 },
  { id: 'text', icon: Type, get label() { return t('railtools.texto') }, key: 'T', group: 1 },
  { id: 'stamp', icon: Stamp, get label() { return t('railtools.carimbo') }, key: 'B', group: 1 },
  { id: 'image', icon: ImagePlus, get label() { return t('railtools.imagem_assinatura') }, key: 'P', group: 1 },
  { id: 'redact', icon: Eraser, get label() { return t('railtools.tarja_corrigir_texto') }, key: 'D', group: 1 },
  { id: 'calibrate', icon: Scaling, get label() { return t('railtools.calibrar_escala') }, key: 'S', group: 2 },
  { id: 'length', icon: Ruler, get label() { return t('railtools.comprimento') }, key: 'L', group: 2 },
  { id: 'area', icon: Pentagon, get label() { return t('railtools.area') }, key: 'K', group: 2 },
  { id: 'fill', icon: PaintBucket, get label() { return t('railtools.area_por_clique') }, key: 'G', group: 2 },
  { id: 'hole', icon: SquareDashed, get label() { return t('railtools.vazio_descontar_da_area') }, key: 'O', group: 2 },
  { id: 'count', icon: Target, get label() { return t('railtools.contagem') }, key: 'N', group: 2 },
  { id: 'symbol', icon: ScanSearch, get label() { return t('railtools.contagem_automatica') }, key: 'Q', group: 2 },
  { id: 'space', icon: Building2, get label() { return t('railtools.ambiente') }, key: 'M', group: 2 },
  { id: 'solid', icon: Box, get label() { return t('railtools.solido_3d_base_na_planta') }, key: 'U', group: 2 },
  { id: 'viewport', icon: Frame, get label() { return t('railtools.viewport_escala_propria') }, key: 'X', group: 2 },
]
