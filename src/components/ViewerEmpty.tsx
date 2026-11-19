import type { DragEvent, RefObject } from 'react'
import { t } from '../i18n'
import { Icon } from './Icon'

/** Tela inicial (nenhum documento aberto), no estilo R3: área de soltar tracejada sobre a mesa. Arrastar um PDF, abrir ou experimentar com a planta de exemplo. */
export function ViewerEmpty({ boxRef, dragOver, setDragOver, onDrop, onOpen, onSample }: {
  boxRef: RefObject<HTMLDivElement | null>
  dragOver: boolean
  setDragOver: (v: boolean) => void
  onDrop: (e: DragEvent) => void
  onOpen: () => void
  onSample: () => void
}) {
  return (
    <div
      className={`viewer empty rx ${dragOver ? 'drag' : ''}`}
      ref={boxRef}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="drop" role="region" aria-label={t('viewerempty.soltar_um_pdf')}>
        <div className="dr-ic"><Icon name="abrir" size={32} /></div>
        <h2>{t('viewerempty.abra_uma_prancha_para_comecar')}</h2>
        <p>{t('viewerempty.arraste_um_pdf_aqui_ou')}</p>
        <div className="dr-bt">
          <button type="button" className="btn pri" onClick={onOpen}>{t('viewerempty.abrir_pdf')}</button>
          <button type="button" className="btn" onClick={onSample} title={t('viewerempty.uma_planta_pronta_para_testar')}>{t('viewerempty.experimentar_com_uma_planta_de')}</button>
        </div>
        <kbd>Ctrl+O</kbd>
      </div>
    </div>
  )
}
