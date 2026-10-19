import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { curSheet, useStore } from '../store'
import { layersOf } from '../pdf'
import type { LayerInfo } from '../pdf'

/** Liga/desliga as camadas (OCG) que vêm do AutoCAD/Revit no PDF. */
export function LayersPanel() {
  const s = useStore()
  const sh = curSheet(s)
  const src = sh ? s.sources[sh.src] : undefined
  const [layers, setLayers] = useState<LayerInfo[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    setLayers(null)
    if (src) layersOf(src).then(setLayers)
  }, [src?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!src) return <p className="muted pad">Abra um PDF.</p>
  const hidden = s.hiddenLayers[src.id] ?? []
  const setHidden = (h: string[]) => s.set({ hiddenLayers: { ...s.hiddenLayers, [src.id]: h } })
  const toggle = (id: string) => setHidden(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  const list = (layers ?? []).filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="dock-body">
      {layers === null && <p className="muted small dock-note">Lendo camadas…</p>}
      {layers && !layers.length && <p className="muted small dock-note">Este PDF não tem camadas. Ao exportar do AutoCAD, marque "incluir informações de camada" para poder ligar/desligar aqui.</p>}
      {layers && layers.length > 0 && (
        <>
          <div className="toolbar-row" style={{ padding: '6px 4px' }}>
            <input className="search" placeholder={`Filtrar ${layers.length} camadas…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="row" style={{ padding: '0 4px 6px' }}>
            <button className="btn sm ghost" onClick={() => setHidden([])}>Mostrar todas</button>
            <button className="btn sm ghost" onClick={() => setHidden(layers.map((l) => l.id))}>Ocultar todas</button>
          </div>
          {list.map((l) => {
            const off = hidden.includes(l.id)
            return (
              <button key={l.id} className={`dock-action layer ${off ? 'off' : ''}`} style={{ paddingLeft: 9 + l.depth * 14 }} onClick={() => toggle(l.id)}>
                {off ? <EyeOff size={15} /> : <Eye size={15} />}
                <span className="grow">{l.name}</span>
              </button>
            )
          })}
          <p className="muted small dock-note">Camadas ocultas também saem do snap, das medições por clique e (opcionalmente) do PDF exportado.</p>
        </>
      )}
    </div>
  )
}
