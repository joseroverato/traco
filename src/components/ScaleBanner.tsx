import { useStore } from '../store'
import { paperScale } from '../geometry'

/** Aviso "Folha sem escala": oferece usar a escala lida do carimbo, calibrar por cota ou escolher uma. */
export function ScaleBanner({ sheetId, detected, onHide }: { sheetId: string; detected: number | null; onHide: () => void }) {
  const s = useStore()
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
