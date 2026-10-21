import { Box, Building2, PaintBucket, ScanSearch, SquareDashed, Eraser, ArrowUpRight, Circle, Cloud, Frame, Hand, ImagePlus, Minus, MousePointer2, Pentagon, Ruler, Scaling, Square, Stamp, Target, Type } from 'lucide-react'
import type { Tool } from './types'
import { t } from './i18n'
import { keyOf } from './hotkeys'

export const TOOLS: { id: Tool; icon: typeof Square; label: string; key: string; group: number }[] = [
  { id: 'select', icon: MousePointer2, get label() { return t('railtools.selecionar') }, get key() { return keyOf('select') }, group: 0 },
  { id: 'pan', icon: Hand, get label() { return t('railtools.mover_vista') }, get key() { return keyOf('pan') }, group: 0 },
  { id: 'cloud', icon: Cloud, get label() { return t('railtools.nuvem_de_revisao') }, get key() { return keyOf('cloud') }, group: 1 },
  { id: 'rect', icon: Square, get label() { return t('railtools.retangulo') }, get key() { return keyOf('rect') }, group: 1 },
  { id: 'ellipse', icon: Circle, get label() { return t('railtools.elipse') }, get key() { return keyOf('ellipse') }, group: 1 },
  { id: 'arrow', icon: ArrowUpRight, get label() { return t('railtools.seta') }, get key() { return keyOf('arrow') }, group: 1 },
  { id: 'line', icon: Minus, get label() { return t('railtools.linha') }, get key() { return keyOf('line') }, group: 1 },
  { id: 'text', icon: Type, get label() { return t('railtools.texto') }, get key() { return keyOf('text') }, group: 1 },
  { id: 'stamp', icon: Stamp, get label() { return t('railtools.carimbo') }, get key() { return keyOf('stamp') }, group: 1 },
  { id: 'image', icon: ImagePlus, get label() { return t('railtools.imagem_assinatura') }, get key() { return keyOf('image') }, group: 1 },
  { id: 'redact', icon: Eraser, get label() { return t('railtools.tarja_corrigir_texto') }, get key() { return keyOf('redact') }, group: 1 },
  { id: 'calibrate', icon: Scaling, get label() { return t('railtools.calibrar_escala') }, get key() { return keyOf('calibrate') }, group: 2 },
  { id: 'length', icon: Ruler, get label() { return t('railtools.comprimento') }, get key() { return keyOf('length') }, group: 2 },
  { id: 'area', icon: Pentagon, get label() { return t('railtools.area') }, get key() { return keyOf('area') }, group: 2 },
  { id: 'fill', icon: PaintBucket, get label() { return t('railtools.area_por_clique') }, get key() { return keyOf('fill') }, group: 2 },
  { id: 'hole', icon: SquareDashed, get label() { return t('railtools.vazio_descontar_da_area') }, get key() { return keyOf('hole') }, group: 2 },
  { id: 'count', icon: Target, get label() { return t('railtools.contagem') }, get key() { return keyOf('count') }, group: 2 },
  { id: 'symbol', icon: ScanSearch, get label() { return t('railtools.contagem_automatica') }, get key() { return keyOf('symbol') }, group: 2 },
  { id: 'space', icon: Building2, get label() { return t('railtools.ambiente') }, get key() { return keyOf('space') }, group: 2 },
  { id: 'solid', icon: Box, get label() { return t('railtools.solido_3d_base_na_planta') }, get key() { return keyOf('solid') }, group: 2 },
  { id: 'viewport', icon: Frame, get label() { return t('railtools.viewport_escala_propria') }, get key() { return keyOf('viewport') }, group: 2 },
]
