import { useState } from 'react'
import { useStore } from '../../store'
import { useLayers, toggleLayer, showAllLayers, hideAllLayers } from '../../layerOps'
import { Glyph } from '../Icon'
import { t } from '../../i18n'

/** Camadas (OCG) do PDF da folha: filtrar, ligar e desligar; Mostrar todas / Ocultar todas. */
export function LayersPalette() {
  const { src, layers } = useLayers()
  const hidden = useStore((s) => (src ? s.hiddenLayers[src.id] : undefined)) ?? []
  const [q, setQ] = useState('')
  if (!src) return <p className="pvz">{t('layerspanel.abra_um_pdf')}</p>
  if (layers === null) return <p className="pvz">{t('layerspanel.lendo_camadas')}</p>
  if (!layers.length) return <p className="pvz">{t('layerspanel.este_pdf_nao_tem_camadas')}</p>
  const list = layers.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="pbar">
        <input className="in" type="search" placeholder={t('layerspanel.filtrar_camadas', { length: layers.length })} aria-label={t('layerspanel.filtrar_camadas', { length: layers.length })} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="pbar">
        <button type="button" className="tbn txt" onClick={showAllLayers}>{t('layerspanel.mostrar_todas')}</button>
        <button type="button" className="tbn txt" onClick={() => void hideAllLayers()}>{t('layerspanel.ocultar_todas')}</button>
      </div>
      <div className="tree" role="group">
        {list.map((l) => {
          const on = !hidden.includes(l.id)
          return (
            <button key={l.id} type="button" role="checkbox" aria-checked={on} className={`tr-row lyr${on ? '' : ' vz'}`} style={{ paddingLeft: 6 + l.depth * 11, width: '100%' }} onClick={() => toggleLayer(src.id, l.id)}>
              <span className="ck">{on && <Glyph name="check" size={10} />}</span>
              <span className="tx">{l.name}</span>
            </button>
          )
        })}
      </div>
      <p className="pvz">{t('layerspanel.camadas_ocultas_tambem_saem_do')}</p>
    </div>
  )
}
