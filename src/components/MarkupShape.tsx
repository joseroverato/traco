import type { Markup, PageScale, Preset, Pt } from '../types'
import { DEFAULT_SOLID_HEIGHT, arrowHead, bbox, centroid, cloudPath, fmt, measureOf, ringsPath, stampText } from '../geometry'
import type { Qty } from '../geometry'
import { t } from '../i18n'

const derived = (p?: Preset) => !!p && (!!p.formula?.trim() || (p.factor !== 1 && !!p.factor))
function qtyText(q: Qty | null, p: Preset | undefined, baseUnit: string, deduct: boolean) {
  if (!q) return t('markupshape.sem_escala')
  if (q.error) return t('markupshape.erro_na_formula')
  const sign = deduct ? '− ' : ''
  return `${sign}${fmt(q.raw)} ${baseUnit}${derived(p) ? ` → ${fmt(Math.abs(q.value))} ${q.unit}` : ''}`
}

interface Props {
  m: Markup
  preset?: Preset
  scale?: PageScale
  zoom: number
  selected: boolean
  draft?: boolean
  stampCtx?: { n: number; total: number; label: string; file: string; author: string }
}

const dashArray = (d: Preset['dash'] | undefined, w: number) =>
  d === 'dash' ? `${w * 4} ${w * 2.5}` : d === 'dot' ? `${w} ${w * 2}` : undefined

export function PatternDefs({ presets }: { presets: Preset[] }) {
  return (
    <defs>
      {presets.map((p) => {
        if (p.pattern === 'solid' || p.pattern === 'none') return null
        const s = 6
        return (
          <pattern key={p.id} id={`pat-${p.id}`} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform={p.pattern === 'dots' ? undefined : 'rotate(45)'}>
            <rect width={s} height={s} fill={p.color} fillOpacity={p.opacity * 0.5} />
            {p.pattern === 'hatch' && <line x1="0" y1="0" x2="0" y2={s} stroke={p.color} strokeWidth="1.2" strokeOpacity={Math.min(1, p.opacity * 3)} />}
            {p.pattern === 'cross' && (
              <>
                <line x1="0" y1="0" x2="0" y2={s} stroke={p.color} strokeWidth="1" strokeOpacity={Math.min(1, p.opacity * 3)} />
                <line x1="0" y1="0" x2={s} y2="0" stroke={p.color} strokeWidth="1" strokeOpacity={Math.min(1, p.opacity * 3)} />
              </>
            )}
            {p.pattern === 'dots' && <circle cx={s / 2} cy={s / 2} r="1.1" fill={p.color} fillOpacity={Math.min(1, p.opacity * 3)} />}
          </pattern>
        )
      })}
    </defs>
  )
}

function Label({ at, text, color, zoom }: { at: Pt; text: string; color: string; zoom: number }) {
  const fs = 11 / zoom
  return (
    <text
      x={at.x}
      y={at.y}
      fontSize={fs}
      fontWeight={700}
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      stroke="var(--label-halo)"
      strokeWidth={3.5 / zoom}
      paintOrder="stroke"
      style={{ pointerEvents: 'none', fontFamily: 'var(--font)' }}
    >
      {text}
    </text>
  )
}

function CountSymbol({ p, preset, color, r, n, zoom }: { p: Pt; preset?: Preset; color: string; r: number; n: number; zoom: number }) {
  const sym = preset?.symbol ?? 'circle'
  const common = { fill: color, fillOpacity: 0.85, stroke: 'var(--label-halo)', strokeWidth: 1 / zoom }
  let shape
  switch (sym) {
    case 'square':
      shape = <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={r * 0.2} {...common} />
      break
    case 'triangle':
      shape = <path d={`M ${p.x} ${p.y - r * 1.15} L ${p.x + r} ${p.y + r * 0.75} L ${p.x - r} ${p.y + r * 0.75} Z`} {...common} />
      break
    case 'diamond':
      shape = <path d={`M ${p.x} ${p.y - r * 1.2} L ${p.x + r * 1.2} ${p.y} L ${p.x} ${p.y + r * 1.2} L ${p.x - r * 1.2} ${p.y} Z`} {...common} />
      break
    case 'cross':
      shape = (
        <path d={`M ${p.x - r} ${p.y - r} L ${p.x + r} ${p.y + r} M ${p.x + r} ${p.y - r} L ${p.x - r} ${p.y + r}`} stroke={color} strokeWidth={r * 0.45} strokeLinecap="round" />
      )
      break
    default:
      shape = <circle cx={p.x} cy={p.y} r={r} {...common} />
  }
  return (
    <g>
      {shape}
      {sym === 'letter' || preset?.letter ? (
        <>
          {sym === 'letter' && <circle cx={p.x} cy={p.y} r={r} {...common} />}
          <text x={p.x} y={p.y} fontSize={r * 1.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#fff" style={{ pointerEvents: 'none' }}>
            {preset?.letter || n}
          </text>
        </>
      ) : null}
    </g>
  )
}

export function MarkupShape({ m, preset, scale, zoom, selected, draft, stampCtx }: Props) {
  const color = m.color
  const w = m.width
  const dash = dashArray(preset?.dash, w)
  const fill =
    preset && preset.pattern !== 'solid' && preset.pattern !== 'none' && m.kind === 'area'
      ? `url(#pat-${preset.id})`
      : m.fillOpacity > 0
        ? m.fill
        : 'none'
  const fillOpacity = fill.startsWith('url') ? 1 : m.fillOpacity
  const glow = selected ? { filter: 'drop-shadow(0 0 2px var(--accent))' } : undefined
  const hitW = Math.max(w, 10 / zoom)
  const [a, b] = m.points
  const props = { 'data-id': m.id, style: { cursor: draft ? 'crosshair' : 'move', ...glow } }
  const q = measureOf(m, scale, preset)

  let body: React.ReactNode = null
  let label: React.ReactNode = null

  switch (m.kind) {
    case 'rect':
    case 'ellipse': {
      if (!a || !b) break
      const bb = bbox([a, b])
      body =
        m.kind === 'rect' ? (
          <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h} stroke={color} strokeWidth={w} fill={m.fillOpacity ? m.fill : 'transparent'} fillOpacity={m.fillOpacity || 1} />
        ) : (
          <ellipse cx={bb.x + bb.w / 2} cy={bb.y + bb.h / 2} rx={bb.w / 2} ry={bb.h / 2} stroke={color} strokeWidth={w} fill={m.fillOpacity ? m.fill : 'transparent'} fillOpacity={m.fillOpacity || 1} />
        )
      break
    }
    case 'cloud':
      if (!a || !b) break
      body = <path d={cloudPath(a, b, 9)} stroke={color} strokeWidth={w} fill={m.fillOpacity ? m.fill : 'transparent'} fillOpacity={m.fillOpacity || 1} strokeLinejoin="round" />
      break
    case 'line':
    case 'arrow':
      if (!a || !b) break
      body = (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={hitW} />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w} strokeLinecap="round" />
          {m.kind === 'arrow' && <path d={'M ' + arrowHead(a, b, Math.max(8, w * 5)).map((p) => `${p.x} ${p.y}`).join(' L ')} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </g>
      )
      break
    case 'text': {
      if (!a || !b) break
      const bb = bbox([a, b])
      body = (
        <g>
          <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h} fill="var(--text-box)" fillOpacity={0.92} stroke={color} strokeWidth={w} rx={2} />
          <foreignObject x={bb.x} y={bb.y} width={bb.w} height={bb.h} style={{ pointerEvents: 'none' }}>
            <div style={{ padding: 4, fontSize: m.fontSize, lineHeight: 1.25, color, fontFamily: 'var(--font)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m.text || (draft ? '' : t('markupshape.texto'))}
            </div>
          </foreignObject>
        </g>
      )
      break
    }
    case 'stamp': {
      if (!a || !b) break
      const bb = bbox([a, b])
      const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2
      const txt = stampCtx ? stampText(m.text, stampCtx) : m.text
      body = (
        <g transform={m.angle ? `rotate(${m.angle} ${cx} ${cy})` : undefined} opacity={m.opacity ?? 1}>
          <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h} fill="transparent" stroke={m.width ? color : 'none'} strokeWidth={m.width} rx={m.width ? 3 : 0} />
          <text x={cx} y={cy} fontSize={m.fontSize} fontWeight={700} fill={color} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'var(--font)', letterSpacing: 0.5, pointerEvents: 'none' }}>
            {txt.split('\n').map((line, i, arr) => (
              <tspan key={i} x={cx} dy={i === 0 ? `${-(arr.length - 1) * 0.6}em` : '1.2em'}>{line}</tspan>
            ))}
          </text>
        </g>
      )
      break
    }
    case 'image': {
      if (!a || !b || !m.image) break
      const bb = bbox([a, b])
      body = <image href={m.image} x={bb.x} y={bb.y} width={bb.w} height={bb.h} preserveAspectRatio="none" opacity={m.opacity ?? 1} />
      break
    }
    case 'redact': {
      if (!a || !b) break
      const bb = bbox([a, b])
      body = (
        <g>
          <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h} fill={m.fill} stroke={m.fill === '#ffffff' ? '#e5484d' : '#000'} strokeWidth={m.fill === '#ffffff' ? 0.8 / zoom : 0} strokeDasharray={`${3 / zoom} ${2 / zoom}`} />
          {m.text ? (
            <text x={bb.x + 2} y={bb.y + bb.h / 2} fontSize={m.fontSize} fill={m.fill === '#000000' ? '#fff' : '#000'} dominantBaseline="central" style={{ fontFamily: 'Helvetica, Arial, sans-serif', pointerEvents: 'none' }}>{m.text}</text>
          ) : m.fill === '#000000' && bb.w > 30 ? (
            <text x={bb.x + bb.w / 2} y={bb.y + bb.h / 2} fontSize={Math.min(8, bb.h * 0.6)} fill="#666" textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{t('markupshape.tarja')}</text>
          ) : null}
        </g>
      )
      break
    }
    case 'viewport': {
      if (!a || !b) break
      const bb = bbox([a, b])
      body = (
        <g>
          <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h} fill="#0090ff" fillOpacity={0.04} stroke="#0090ff" strokeWidth={1.2 / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} style={{ pointerEvents: 'none' }} />
          <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h} fill="none" stroke="transparent" strokeWidth={10 / zoom} style={{ pointerEvents: 'stroke' }} />
        </g>
      )
      label = (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={bb.x} y={bb.y - 16 / zoom} width={Math.max(64, (m.text || 'Viewport').length * 6.5 + 50) / zoom} height={15 / zoom} rx={3 / zoom} fill="#0090ff" />
          <text x={bb.x + 5 / zoom} y={bb.y - 8.5 / zoom} fontSize={10 / zoom} fontWeight={600} fill="#fff" dominantBaseline="central" style={{ fontFamily: 'var(--font)' }}>
            {(m.text || 'Viewport') + ' · ' + (m.scale?.label ?? t('markupshape.sem_escala'))}
          </text>
        </g>
      )
      break
    }
    case 'length': {
      const d = m.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
      body = (
        <g>
          <path d={d} stroke="transparent" strokeWidth={hitW} fill="none" />
          <path d={d} stroke={color} strokeWidth={w} strokeDasharray={dash} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity={m.deduct ? 0.55 : 1} />
          {m.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={Math.max(w * 0.7, 1.5 / zoom)} fill={color} />
          ))}
        </g>
      )
      if (m.points.length > 1 && (preset?.showLabel ?? true)) {
        let best = 0, bi = 1
        for (let i = 1; i < m.points.length; i++) {
          const L = Math.hypot(m.points[i].x - m.points[i - 1].x, m.points[i].y - m.points[i - 1].y)
          if (L > best) { best = L; bi = i }
        }
        const mid = { x: (m.points[bi].x + m.points[bi - 1].x) / 2, y: (m.points[bi].y + m.points[bi - 1].y) / 2 - 9 / zoom }
        label = <Label at={mid} color={color} zoom={zoom} text={qtyText(q, preset, 'm', m.deduct)} />
      }
      break
    }
    case 'area': {
      const d = draft ? m.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') : ringsPath(m.points, m.holes)
      body = (
        <path
          d={d}
          fillRule="evenodd"
          stroke={color}
          strokeWidth={w}
          strokeDasharray={m.deduct ? `${w * 3} ${w * 2}` : dash}
          fill={m.deduct ? 'transparent' : fill}
          fillOpacity={fillOpacity}
          strokeLinejoin="round"
        />
      )
      if (m.points.length > 2 && (preset?.showLabel ?? true))
        label = <Label at={centroid(m.points)} color={color} zoom={zoom} text={qtyText(q, preset, 'm²', m.deduct)} />
      break
    }
    case 'space': {
      const d = draft ? m.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') : ringsPath(m.points, m.holes)
      body = <path d={d} fillRule="evenodd" stroke={color} strokeWidth={1.2 / zoom} strokeDasharray={`${8 / zoom} ${4 / zoom}`} fill={color} fillOpacity={0.07} strokeLinejoin="round" />
      if (m.points.length > 2 && !draft) {
        const c = centroid(m.points)
        label = (
          <g style={{ pointerEvents: 'none' }}>
            <Label at={{ x: c.x, y: c.y - 7 / zoom }} color={color} zoom={zoom} text={m.text || t('markupshape.ambiente')} />
            {q && <Label at={{ x: c.x, y: c.y + 7 / zoom }} color={color} zoom={zoom} text={`${fmt(q.vars.A)} m²`} />}
          </g>
        )
      }
      break
    }
    case 'solid': {
      const d = draft ? m.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') : ringsPath(m.points, m.holes)
      body = <path d={d} fillRule="evenodd" stroke={color} strokeWidth={1.8 / zoom} fill={color} fillOpacity={0.22} strokeLinejoin="round" />
      if (m.points.length > 2 && !draft) {
        const c = centroid(m.points)
        label = (
          <g style={{ pointerEvents: 'none' }}>
            <Label at={{ x: c.x, y: c.y - 7 / zoom }} color={color} zoom={zoom} text={m.text || t('markupshape.solido')} />
            <Label at={{ x: c.x, y: c.y + 7 / zoom }} color={color} zoom={zoom} text={q ? `h = ${fmt(m.height ?? DEFAULT_SOLID_HEIGHT)} m · ${fmt(q.vars.VOL)} m³` : `h = ${fmt(m.height ?? DEFAULT_SOLID_HEIGHT)} m`} />
          </g>
        )
      }
      break
    }
    case 'count': {
      const r = Math.max(5, 7 / zoom)
      body = (
        <g>
          {m.points.map((p, i) => (
            <CountSymbol key={i} p={p} preset={preset} color={color} r={r} n={i + 1} zoom={zoom} />
          ))}
        </g>
      )
      if (m.points.length && (preset?.showLabel ?? true)) {
        const last = m.points[m.points.length - 1]
        label = <Label at={{ x: last.x + r * 3, y: last.y - r * 1.8 }} color={color} zoom={zoom} text={`${m.points.length} un`} />
      }
      break
    }
  }
  return (
    <g {...props}>
      {body}
      {label}
    </g>
  )
}
