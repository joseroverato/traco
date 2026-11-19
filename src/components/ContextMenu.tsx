import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { Icon } from './Icon'

export type MenuItem =
  | { sep: true }
  /** título de seção (ex.: "Folha atual", "Biblioteca"): não é selecionável */
  | { title: string }
  | {
      id: string
      label: string
      icon?: LucideIcon
      /** ícone próprio do Traço (id do sprite), no lugar do ícone genérico */
      iconId?: string
      /** tecla de atalho mostrada à direita */
      hint?: string
      onClick: () => void
      disabled?: boolean
      /** item de liga/desliga (mostra o visto) */
      checked?: boolean
      danger?: boolean
    }

const isSep = (i: MenuItem): i is { sep: true } => 'sep' in i
const isTitle = (i: MenuItem): i is { title: string } => 'title' in i
const isItem = (i: MenuItem): i is Exclude<MenuItem, { sep: true } | { title: string }> => !isSep(i) && !isTitle(i)

/**
 * Menu do botão direito: abre no ponteiro, cabe sempre na janela, fecha ao clicar fora, rolar, redimensionar ou com Esc.
 * Teclado: setas, Home/End, Enter.
 */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; transformOrigin?: string }>({ left: x, top: y })
  const [cur, setCur] = useState(-1)
  const enabled = items.map((i, n) => (isItem(i) && !i.disabled ? n : -1)).filter((n) => n >= 0)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const m = 8
    const left = Math.max(m, Math.min(x, innerWidth - r.width - m))
    const top = Math.max(m, Math.min(y, innerHeight - r.height - m))
    // o menu cresce a partir do ponteiro, mesmo quando foi empurrado para caber na janela
    setPos({ left, top, transformOrigin: `${x - left}px ${y - top}px` })
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
    if (!isItem(i) || i.disabled) return
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
    <div ref={box} className="ctxmenu rx mn ctxm" role="menu" tabIndex={-1} style={pos} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, n) => {
        if (isSep(it)) return <div key={`s${n}`} className="mn-s" role="separator" />
        if (isTitle(it)) return <div key={`t${n}`} className="mn-h" role="presentation">{it.title}</div>
        const I = it.icon
        return (
          <button key={it.id} type="button" role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={it.checked} disabled={it.disabled} className={`mn-i${it.danger ? ' dg' : ''}${cur === n ? ' on' : ''}${it.disabled ? ' off' : ''}`} onMouseEnter={() => setCur(n)} onClick={() => run(it)}>
            <span className="mn-v">{it.checked ? <Check size={14} /> : it.iconId ? <Icon name={it.iconId} size={16} /> : I ? <I size={15} /> : null}</span>
            <span className="sl">{it.label}</span>
            {it.hint && <kbd>{it.hint}</kbd>}
          </button>
        )
      })}
    </div>
  )
}
