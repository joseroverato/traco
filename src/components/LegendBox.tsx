import { useStore } from '../store'
import { bbox, fmt } from '../geometry'
import { summarize } from '../summary'
import type { Markup } from '../types'

/** Linhas da legenda (também usadas na exportação para PDF). */
export function legendRows(m: Markup) {
  const s = useStore.getState()
  const scope = m.legend?.scope ?? 'sheet'
  const ms = s.markups.filter((x) => x.kind !== 'viewport' && (scope === 'all' || x.page === m.page))
  return summarize(ms, s.presets, s.scales, s.sheets, s.markups)
}

/** Geometria da tabela da legenda em unidades da folha (pt). */
export function legendLayout(m: Markup, rows: ReturnType<typeof legendRows>) {
  const b = bbox(m.points)
  const fs = m.fontSize || 8
  const lh = fs * 1.7
  const head = fs * 2.2
  const prices = !!m.legend?.prices && rows.some((r) => r.price)
  return { x: b.x, y: b.y, w: Math.max(160, b.w), h: head + Math.max(1, rows.length) * lh + (prices ? lh : 0) + fs * 0.6, fs, lh, head, prices }
}

export function LegendBox({ m, zoom, selected }: { m: Markup; zoom: number; selected: boolean }) {
  useStore((s) => s.markups) // re-render quando as medições mudam
  const rows = legendRows(m)
  const L = legendLayout(m, rows)
  const total = rows.reduce((t, r) => t + r.total, 0)
  const colQ = L.x + L.w * (L.prices ? 0.62 : 0.78)
  return (
    <g data-id={m.id} style={{ cursor: 'move', filter: selected ? 'drop-shadow(0 0 2px var(--accent))' : undefined }}>
      <rect x={L.x} y={L.y} width={L.w} height={L.h} fill="#ffffff" stroke="#1f2937" strokeWidth={0.8} />
      <rect x={L.x} y={L.y} width={L.w} height={L.head} fill="#1f2937" />
      <text x={L.x + L.fs * 0.6} y={L.y + L.head * 0.62} fontSize={L.fs * 1.05} fontWeight={700} fill="#fff" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
        QUANTITATIVO {m.legend?.scope === 'all' ? '— PROJETO' : '— FOLHA'}
      </text>
      {rows.length === 0 && (
        <text x={L.x + L.fs * 0.6} y={L.y + L.head + L.lh * 0.7} fontSize={L.fs} fill="#6b7280" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Sem medições</text>
      )}
      {rows.map((r, i) => {
        const y = L.y + L.head + i * L.lh
        return (
          <g key={r.key} style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            {i % 2 === 1 && <rect x={L.x + 0.4} y={y} width={L.w - 0.8} height={L.lh} fill="#f3f4f6" />}
            <rect x={L.x + L.fs * 0.6} y={y + L.lh * 0.25} width={L.fs * 1.2} height={L.lh * 0.5} fill={r.color} fillOpacity={0.8} />
            <text x={L.x + L.fs * 2.3} y={y + L.lh * 0.66} fontSize={L.fs} fill="#111827">{r.name.length > 48 ? r.name.slice(0, 46) + '…' : r.name}</text>
            <text x={colQ} y={y + L.lh * 0.66} fontSize={L.fs} fill="#111827" textAnchor="end" fontWeight={700}>{fmt(r.qty)} {r.unit}</text>
            {L.prices && <text x={L.x + L.w - L.fs * 0.6} y={y + L.lh * 0.66} fontSize={L.fs} fill="#111827" textAnchor="end">{r.price ? `R$ ${fmt(r.total)}` : '—'}</text>}
          </g>
        )
      })}
      {L.prices && (
        <text x={L.x + L.w - L.fs * 0.6} y={L.y + L.head + rows.length * L.lh + L.lh * 0.7} fontSize={L.fs} fontWeight={700} fill="#111827" textAnchor="end" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
          Total R$ {fmt(total)}
        </text>
      )}
      <rect x={L.x} y={L.y} width={L.w} height={L.h} fill="transparent" />
      {selected && <rect x={L.x + L.w - 5 / zoom} y={L.y + L.h - 5 / zoom} width={10 / zoom} height={10 / zoom} fill="var(--handle-fill)" stroke="var(--accent)" strokeWidth={1.5 / zoom} data-handle={1} data-mid={m.id} style={{ cursor: 'ew-resize' }} />}
    </g>
  )
}
