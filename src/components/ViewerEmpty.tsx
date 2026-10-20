import type { DragEvent, RefObject } from 'react'
import { FileUp } from 'lucide-react'

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
        <h2>Abra uma prancha para começar</h2>
        <p>Arraste um PDF aqui ou</p>
        <button className="btn primary" onClick={onOpen}>Abrir PDF</button>
        <button className="btn ghost" onClick={onSample} data-tip="Uma planta pronta para testar, com um passo a passo">Experimentar com uma planta de exemplo</button>
        <div className="kbd-hint"><kbd>Ctrl</kbd>+<kbd>O</kbd></div>
      </div>
    </div>
  )
}
