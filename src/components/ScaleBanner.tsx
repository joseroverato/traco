import { useStore } from '../store'
import { paperScale, scaleMismatch } from '../geometry'
import type { PageScale } from '../types'

/** Aviso "Folha sem escala": oferece usar a escala lida do carimbo, calibrar por cota ou escolher uma. */
export function ScaleBanner({ sheetId, detected, current, onHide }: { sheetId: string; detected: number | null; current?: PageScale; onHide: () => void }) {
  const s = useStore()
  if (current) {
    // folha com escala: só avisa se ela destoa da escrita no carimbo
    const n = detected ? scaleMismatch(current.metersPerUnit, detected) : null
    if (!detected || n === null) return null
    return (
      <div className="scale-banner" onPointerDown={(e) => e.stopPropagation()}>
        <span className="dot-warn" /> A escala da folha (1:{n}) difere da do carimbo (1:{detected})
        <button className="btn sm primary" onClick={() => { s.set({ scales: { ...s.scales, [sheetId]: { metersPerUnit: paperScale(detected), label: `1:${detected}` } } }); s.notify(`Escala 1:${detected} aplicada (lida do carimbo)`); onHide() }}>
          Usar 1:{detected}
        </button>
        <button className="btn sm ghost" onClick={onHide} data-tip="Mantém a escala atual (ex.: calibrada por cota)">Manter 1:{n}</button>
      </div>
    )
  }
  return (
    <div className="scale-banner" onPointerDown={(e) => e.stopPropagation()}>
      <span className="dot-warn" /> Folha sem escala
      {detected && (
        <button className="btn sm primary" onClick={() => { s.set({ scales: { ...s.scales, [sheetId]: { metersPerUnit: paperScale(detected), label: `1:${detected}` } } }); s.notify(`Escala 1:${detected} aplicada (lida do carimbo)`) }}>
          Usar 1:{detected} do carimbo
        </button>
      )}
      <button className="btn sm" onClick={() => s.set({ tool: 'calibrate' })}>Calibrar por cota</button>
      <button className="btn sm ghost" onClick={() => s.set({ calibrating: { page: sheetId, length: 0 } })}>Escolher escala</button>
      <button className="icon-btn xs" onClick={onHide} aria-label="Fechar">✕</button>
    </div>
  )
}
