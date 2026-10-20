import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { curSheet, useStore } from '../store'
import { layersOf } from '../pdf'
import type { LayerInfo } from '../pdf'
import { t } from '../i18n'

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
  if (!src) return <p className="muted pad">{t('layerspanel.abra_um_pdf')}</p>
  const hidden = s.hiddenLayers[src.id] ?? []
  const setHidden = (h: string[]) => s.set({ hiddenLayers: { ...s.hiddenLayers, [src.id]: h } })
  const toggle = (id: string) => setHidden(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  const list = (layers ?? []).filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="dock-body">
      {layers === null && <p className="muted small dock-note">{t('layerspanel.lendo_camadas')}</p>}
      {layers && !layers.length && <p className="muted small dock-note">{t('layerspanel.este_pdf_nao_tem_camadas')}</p>}
      {layers && layers.length > 0 && (
        <>
          <div className="toolbar-row" style={{ padding: '6px 4px' }}>
            <input className="search" placeholder={t('layerspanel.filtrar_camadas', { length: layers.length })} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="row" style={{ padding: '0 4px 6px' }}>
            <button className="btn sm ghost" onClick={() => setHidden([])}>{t('layerspanel.mostrar_todas')}</button>
            <button className="btn sm ghost" onClick={() => setHidden(layers.map((l) => l.id))}>{t('layerspanel.ocultar_todas')}</button>
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
          <p className="muted small dock-note">{t('layerspanel.camadas_ocultas_tambem_saem_do')}</p>
        </>
      )}
    </div>
  )
}
