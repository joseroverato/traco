import { SNAP_LABEL } from '../snap'
import type { SnapHit } from '../snap'

/** Símbolo do ponto de snap (extremidade, interseção, ponto médio…) desenhado sobre a folha. */
export function SnapMarker({ hit, zoom }: { hit: SnapHit; zoom: number }) {
  const r = 6 / zoom
  const { x, y } = hit.pt
  const sw = 1.6 / zoom
  const c = '#00e07a'
  let shape: React.ReactNode
  switch (hit.kind) {
    case 'endpoint':
      shape = <rect x={x - r} y={y - r} width={r * 2} height={r * 2} />
      break
    case 'intersection':
      shape = <path d={`M ${x - r} ${y - r} L ${x + r} ${y + r} M ${x + r} ${y - r} L ${x - r} ${y + r}`} />
      break
    case 'midpoint':
      shape = <path d={`M ${x} ${y - r * 1.2} L ${x + r * 1.1} ${y + r * 0.8} L ${x - r * 1.1} ${y + r * 0.8} Z`} />
      break
    case 'markup':
      shape = <path d={`M ${x} ${y - r * 1.2} L ${x + r * 1.2} ${y} L ${x} ${y + r * 1.2} L ${x - r * 1.2} ${y} Z`} />
      break
    default:
      shape = <path d={`M ${x - r} ${y - r} L ${x + r} ${y - r} L ${x - r} ${y + r} L ${x + r} ${y + r} Z`} />
  }
  return (
    <g style={{ pointerEvents: 'none' }}>
      {hit.seg && <line x1={hit.seg[0]} y1={hit.seg[1]} x2={hit.seg[2]} y2={hit.seg[3]} stroke={c} strokeWidth={2 / zoom} strokeOpacity={0.55} />}
      <g fill="none" stroke="#0b0b0c" strokeWidth={sw * 2.6} strokeOpacity={0.55}>{shape}</g>
      <g fill="none" stroke={c} strokeWidth={sw}>{shape}</g>
      <text x={x + r * 1.6} y={y - r * 1.4} fontSize={10 / zoom} fontWeight={600} fill={c} stroke="#0b0b0c" strokeWidth={2.5 / zoom} paintOrder="stroke" style={{ fontFamily: 'var(--font)' }}>
        {SNAP_LABEL[hit.kind]}
      </text>
    </g>
  )
}
