import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'

export type MenuItem =
  | { sep: true }
  | {
      id: string
      label: string
      icon?: LucideIcon
      /** tecla de atalho mostrada à direita */
      hint?: string
      onClick: () => void
      disabled?: boolean
      /** item de liga/desliga (mostra o visto) */
      checked?: boolean
      danger?: boolean
    }

const isSep = (i: MenuItem): i is { sep: true } => 'sep' in i

/**
 * Menu do botão direito: abre no ponteiro, cabe sempre na janela, fecha ao clicar fora, rolar, redimensionar ou com Esc.
 * Teclado: setas, Home/End, Enter.
 */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [cur, setCur] = useState(-1)
  const enabled = items.map((i, n) => (!isSep(i) && !i.disabled ? n : -1)).filter((n) => n >= 0)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const m = 8
    setPos({ left: Math.max(m, Math.min(x, innerWidth - r.width - m)), top: Math.max(m, Math.min(y, innerHeight - r.height - m)) })
    el.focus()
  }, [x, y])

  useEffect(() => {
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) onClose()
    }
    const close = () => onClose()
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('contextmenu', away, true)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    window.addEventListener('wheel', close, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('contextmenu', away, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('wheel', close)
    }
  }, [onClose])

  const run = (i: MenuItem) => {
    if (isSep(i) || i.disabled) return
    onClose()
    i.onClick()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose()
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const at = enabled.indexOf(cur)
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
      setCur(enabled[next])
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (cur >= 0) run(items[cur])
    }
  }

  return (
    <div ref={box} className="ctxmenu" role="menu" tabIndex={-1} style={pos} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, n) => {
        if (isSep(it)) return <div key={`s${n}`} className="ctx-sep" role="separator" />
        const I = it.icon
        return (
          <button key={it.id} role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={it.checked} disabled={it.disabled} className={`ctx-item ${it.danger ? 'danger' : ''} ${cur === n ? 'cur' : ''}`} onMouseEnter={() => setCur(n)} onClick={() => run(it)}>
            <span className="ctx-ico">{it.checked ? <Check size={14} /> : I ? <I size={15} /> : null}</span>
            <span className="ctx-label">{it.label}</span>
            {it.hint && <kbd>{it.hint}</kbd>}
          </button>
        )
      })}
    </div>
  )
}
