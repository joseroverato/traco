import type { DragEvent, RefObject } from 'react'
import { FileUp } from 'lucide-react'
import { t } from '../i18n'

/** Tela inicial (nenhum documento aberto): arrastar um PDF, abrir ou experimentar com a planta de exemplo. */
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
      className={`viewer empty ${dragOver ? 'drag' : ''}`}
      ref={boxRef}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="empty-card">
        <div className="empty-icon"><FileUp size={28} strokeWidth={1.6} /></div>
        <h2>{t('viewerempty.abra_uma_prancha_para_comecar')}</h2>
        <p>{t('viewerempty.arraste_um_pdf_aqui_ou')}</p>
        <button className="btn primary" onClick={onOpen}>{t('viewerempty.abrir_pdf')}</button>
        <button className="btn ghost" onClick={onSample} data-tip={t('viewerempty.uma_planta_pronta_para_testar')}>{t('viewerempty.experimentar_com_uma_planta_de')}</button>
        <div className="kbd-hint"><kbd>Ctrl</kbd>+<kbd>O</kbd></div>
      </div>
    </div>
  )
}
