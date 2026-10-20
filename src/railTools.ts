import { Box, Building2, PaintBucket, ScanSearch, SquareDashed, Eraser, ArrowUpRight, Circle, Cloud, Frame, Hand, ImagePlus, Minus, MousePointer2, Pentagon, Ruler, Scaling, Square, Stamp, Target, Type } from 'lucide-react'
import type { Tool } from './types'

export const TOOLS: { id: Tool; icon: typeof Square; label: string; key: string; group: number }[] = [
  { id: 'select', icon: MousePointer2, label: 'Selecionar', key: 'V', group: 0 },
  { id: 'pan', icon: Hand, label: 'Mover vista', key: 'H', group: 0 },
  { id: 'cloud', icon: Cloud, label: 'Nuvem de revisão', key: 'C', group: 1 },
  { id: 'rect', icon: Square, label: 'Retângulo', key: 'R', group: 1 },
  { id: 'ellipse', icon: Circle, label: 'Elipse', key: 'E', group: 1 },
  { id: 'arrow', icon: ArrowUpRight, label: 'Seta', key: 'A', group: 1 },
  { id: 'line', icon: Minus, label: 'Linha', key: 'I', group: 1 },
  { id: 'text', icon: Type, label: 'Texto', key: 'T', group: 1 },
  { id: 'stamp', icon: Stamp, label: 'Carimbo', key: 'B', group: 1 },
  { id: 'image', icon: ImagePlus, label: 'Imagem / assinatura', key: 'P', group: 1 },
  { id: 'redact', icon: Eraser, label: 'Tarja / corrigir texto', key: 'D', group: 1 },
  { id: 'calibrate', icon: Scaling, label: 'Calibrar escala', key: 'S', group: 2 },
  { id: 'length', icon: Ruler, label: 'Comprimento', key: 'L', group: 2 },
  { id: 'area', icon: Pentagon, label: 'Área', key: 'K', group: 2 },
  { id: 'fill', icon: PaintBucket, label: 'Área por clique', key: 'G', group: 2 },
  { id: 'hole', icon: SquareDashed, label: 'Vazio (descontar da área)', key: 'O', group: 2 },
  { id: 'count', icon: Target, label: 'Contagem', key: 'N', group: 2 },
  { id: 'symbol', icon: ScanSearch, label: 'Contagem automática', key: 'Q', group: 2 },
  { id: 'space', icon: Building2, label: 'Ambiente', key: 'M', group: 2 },
  { id: 'solid', icon: Box, label: 'Sólido 3D (base na planta)', key: 'U', group: 2 },
  { id: 'viewport', icon: Frame, label: 'Viewport (escala própria)', key: 'X', group: 2 },
]
