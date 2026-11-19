import { cloneElement, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { ToolDemo } from './ToolDemo'
import { TOOL_INFO } from '../toolInfo'
import type { Tool } from '../types'
import { useStore } from '../store'
import { tipClosed, tipIsWarm, tipOpened } from '../tipWarm'

const DELAY = 450 // ms pausado em cima até mostrar
const W = 260

interface Props {
  tool: Tool
  shortcut?: string
  /** onde a dica abre: à direita do botão (trilho vertical) ou embaixo dele (faixa de opções) */
  side?: 'right' | 'below'
  /** botão que recebe os eventos de mouse/teclado */
  children: ReactElement<React.HTMLAttributes<HTMLElement>>
}

/** Dica rica (estilo Revit): nome, descrição, atalho e mini animação, depois de pausar o mouse sobre a ferramenta. */
export function RichTip({ tool, shortcut, side = 'right', children }: Props) {
  const [at, setAt] = useState<{ x: number; y: number; warm: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const clicked = useRef(false) // depois de clicar na ferramenta a dica não volta até o mouse sair e entrar de novo
  const info = TOOL_INFO[tool]

  const show = (el: HTMLElement) => {
    if (clicked.current) return
    window.clearTimeout(timer.current)
    // depois que uma dica abriu, as das ferramentas vizinhas abrem na hora e sem animação (ver tipWarm.ts)
    const warm = tipIsWarm()
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      // à direita do botão (a barra de ferramentas fica à esquerda); sobe se não couber embaixo
      // na faixa de opções a dica abre embaixo do botão, sem cobrir os vizinhos
      const below = side === 'below'
      const x = Math.max(8, Math.min(below ? r.left : r.right + 12, window.innerWidth - W - 8))
      const y = below ? Math.min(r.bottom + 6, window.innerHeight - 270) : Math.max(8, Math.min(r.top - 8, window.innerHeight - 270))
      setAt({ x, y, warm })
      tipOpened()
    }, warm ? 0 : DELAY)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setAt(null)
    tipClosed()
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // a dica nunca fica presa sobre a folha: some ao clicar em qualquer lugar, ao usar o teclado, ao rolar, ao trocar de janela e quando a ferramenta muda
  useEffect(() => {
    if (!at) return
    const off = () => { window.clearTimeout(timer.current); setAt(null); tipClosed() }
    window.addEventListener('pointerdown', off, true)
    window.addEventListener('keydown', off, true)
    window.addEventListener('wheel', off, { capture: true, passive: true })
    window.addEventListener('blur', off)
    const un = useStore.subscribe((s, p) => { if (s.tool !== p.tool) off() })
    return () => {
      window.removeEventListener('pointerdown', off, true)
      window.removeEventListener('keydown', off, true)
      window.removeEventListener('wheel', off, true)
      window.removeEventListener('blur', off)
      un()
    }
  }, [at])

  const c = children.props
  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { c.onMouseEnter?.(e); show(e.currentTarget) },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { c.onMouseLeave?.(e); clicked.current = false; hide() },
        onMouseDown: (e: React.MouseEvent<HTMLElement>) => { c.onMouseDown?.(e); clicked.current = true; hide() },
        onClick: (e: React.MouseEvent<HTMLElement>) => { c.onClick?.(e); clicked.current = true; hide() },
        // foco por clique/toque não mostra a dica (só o foco pelo teclado)
        onFocus: (e: React.FocusEvent<HTMLElement>) => { c.onFocus?.(e); if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget) },
        onBlur: (e: React.FocusEvent<HTMLElement>) => { c.onBlur?.(e); hide() },
      })}
      {at && createPortal(
        <div className={`rx rich-tip ${at.warm ? 'warm' : ''}`} style={{ left: at.x, top: at.y, width: W }} role="tooltip">
          <div className="rich-tip-head">
            <b>{info.title}</b>
            {shortcut && <kbd>{shortcut}</kbd>}
          </div>
          <p>{info.desc}</p>
          <div className="rich-tip-demo"><ToolDemo demo={info.demo} id={tool} /></div>
        </div>,
        document.body,
      )}
    </>
  )
}
