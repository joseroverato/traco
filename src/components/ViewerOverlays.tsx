import { bbox } from '../geometry'
import { applyM } from '../overlayMath'
import type { M6 } from '../overlayMath'
import type { Markup, Pt } from '../types'

/** Pequenas camadas desenhadas dentro do SVG da folha (em unidades da folha; `zoom` mantém traços e alças com tamanho fixo na tela). */

export interface SearchHit { sheet: string; x: number; y: number; w: number; h: number }

export function SearchHighlights({ hits, page, index, zoom }: { hits: SearchHit[]; page: string; index: number; zoom: number }) {
  return (
    <>
      {hits.map((h, i) =>
        h.sheet === page ? (
          <rect key={`sh${i}`} x={h.x - 1} y={h.y - 1} width={h.w + 2} height={h.h + 2} rx={1} fill="#ffd60a" fillOpacity={i === index ? 0.55 : 0.28} stroke={i === index ? '#ff9f0a' : 'none'} strokeWidth={1.5 / zoom} style={{ pointerEvents: 'none' }} />
        ) : null,
      )}
    </>
  )
}

/** Retângulo tracejado entre dois pontos (seleção por arraste e área de busca de símbolos). */
export function DashedRect({ a, b, zoom, color, fillOpacity, dash = [4, 3], width = 1 }: { a: Pt; b: Pt; zoom: number; color: string; fillOpacity: number; dash?: [number, number]; width?: number }) {
  const r = bbox([a, b])
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={width / zoom} strokeDasharray={`${dash[0] / zoom} ${dash[1] / zoom}`} />
}

export function SymbolMatches({ found, zoom }: { found: { rect: { w: number; h: number }; centers: Pt[] }; zoom: number }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {found.centers.map((c, i) => (
        <rect key={i} x={c.x - found.rect.w / 2 - 2} y={c.y - found.rect.h / 2 - 2} width={found.rect.w + 4} height={found.rect.h + 4} rx={2} fill="#f76b15" fillOpacity={0.12} stroke="#f76b15" strokeWidth={1.4 / zoom} />
      ))}
    </g>
  )
}

/** Pontos já marcados no alinhamento de uma disciplina sobreposta (pares: origem na disciplina, destino na base). */
export function AlignPoints({ pts, overlay, zoom }: { pts: Pt[]; overlay?: { color: string; matrix: M6 }; zoom: number }) {
  return (
    <>
      {pts.map((q, i) => {
        const pt = i % 2 === 0 && overlay ? applyM(overlay.matrix, q) : q
        return <circle key={`al${i}`} cx={pt.x} cy={pt.y} r={5 / zoom} fill={i % 2 === 0 ? overlay?.color ?? '#f00' : 'var(--accent)'} stroke="#fff" strokeWidth={1.5 / zoom} style={{ pointerEvents: 'none' }} />
      })}
    </>
  )
}

/** Alças de edição dos vértices da marcação selecionada. */
export function SelectionHandles({ sel, zoom }: { sel: Pick<Markup, 'id' | 'points'>; zoom: number }) {
  return (
    <>
      {sel.points.map((p, i) => (
        <rect key={i} data-handle={i} data-mid={sel.id} x={p.x - 4 / zoom} y={p.y - 4 / zoom} width={8 / zoom} height={8 / zoom} rx={1.5 / zoom} fill="var(--handle-fill)" stroke="var(--accent)" strokeWidth={1.5 / zoom} style={{ cursor: 'crosshair' }} />
      ))}
    </>
  )
}
