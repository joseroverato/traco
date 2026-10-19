import { useStore } from '../store'
import { bbox } from '../geometry'
import { fitStampBox } from '../viewerLogic'
import type { Markup } from '../types'

/** Caixa de texto flutuante para editar texto/carimbo direto sobre a folha. */
export function TextEditor({ m, zoom, left, top }: { m: Markup; zoom: number; left: number; top: number }) {
  const b = bbox(m.points)
  return (
    <textarea
      className="text-edit"
      ref={(el) => {
        if (el && document.activeElement !== el) {
          el.focus()
          if (m.kind === 'stamp') el.select() // digitar substitui o texto padrão
        }
      }}
      defaultValue={m.text}
      style={{ left: left + b.x * zoom, top: top + b.y * zoom, width: b.w * zoom, height: b.h * zoom, fontSize: m.fontSize * zoom, color: m.color, textAlign: m.kind === 'stamp' ? 'center' : 'left', fontWeight: m.kind === 'stamp' ? 700 : 400 }}
      onBlur={(e) => {
        const s = useStore.getState()
        const text = e.target.value
        if (m.kind === 'stamp') {
          // ajusta a caixa do carimbo ao texto
          s.updateMarkup(m.id, { text, points: fitStampBox(text, m.fontSize, m.points) })
        } else s.updateMarkup(m.id, { text })
        s.set({ editingText: null })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur()
      }}
    />
  )
}
