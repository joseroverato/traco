import type { Preset } from '../../types'

/** Amostra de 22 × 14 do marcador (cor, traço e padrão do próprio marcador; a cor é dado da pessoa). */
export function Sample({ p, className = 'am' }: { p: Pick<Preset, 'measure' | 'color' | 'opacity' | 'width' | 'dash' | 'pattern' | 'symbol' | 'letter'>; className?: string }) {
  const c = p.color
  return (
    <svg className={className} width="22" height="14" viewBox="0 0 22 14" aria-hidden="true" focusable="false">
      {p.measure === 'area' && (
        <>
          <rect x="1" y="1" width="20" height="12" fill={c} fillOpacity={Math.max(0.2, Math.min(0.6, p.opacity + 0.1))} stroke={c} strokeWidth="1.2" />
          {p.pattern === 'hatch' && <path d="M1 9 9 1M1 13 13 1M5 13 17 1M9 13 21 1M13 13 21 5" stroke={c} strokeWidth="0.8" fill="none" />}
          {p.pattern === 'cross' && <path d="M1 9 9 1M1 13 13 1M5 13 17 1M9 13 21 1M13 13 21 5M1 5 5 9M1 1 13 13M9 1 21 13" stroke={c} strokeWidth="0.6" fill="none" />}
          {p.pattern === 'dots' && <path d="M5 4h.1M11 4h.1M17 4h.1M5 10h.1M11 10h.1M17 10h.1M8 7h.1M14 7h.1" stroke={c} strokeWidth="1.6" strokeLinecap="round" />}
        </>
      )}
      {p.measure === 'length' && <path d="M2 11 8 4l5 5 7-6" fill="none" stroke={c} strokeWidth={Math.max(1.4, Math.min(3, p.width / 1.5))} strokeDasharray={p.dash === 'dash' ? '4 2' : p.dash === 'dot' ? '1 2.2' : undefined} strokeLinecap="round" strokeLinejoin="round" />}
      {p.measure === 'count' && (
        <>
          <circle cx="11" cy="7" r="5.5" fill={c} />
          {(p.letter || p.symbol === 'letter') && <text x="11" y="7.4" fontSize="7" fontWeight="700" textAnchor="middle" dominantBaseline="central" fill="#fff">{p.letter || '#'}</text>}
        </>
      )}
    </svg>
  )
}
