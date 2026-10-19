import { cloneElement, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { ToolDemo } from './ToolDemo'
import { TOOL_INFO } from '../toolInfo'
import type { Tool } from '../types'

const DELAY = 450 // ms pausado em cima até mostrar
const W = 260

interface Props {
  tool: Tool
  shortcut?: string
  /** botão que recebe os eventos de mouse/teclado */
  children: ReactElement<React.HTMLAttributes<HTMLElement>>
}

/** Dica rica (estilo Revit): nome, descrição, atalho e mini animação, depois de pausar o mouse sobre a ferramenta. */
export function RichTip({ tool, shortcut, children }: Props) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const info = TOOL_INFO[tool]

  const show = (el: HTMLElement) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      // à direita do botão (a barra de ferramentas fica à esquerda); sobe se não couber embaixo
      const x = Math.min(r.right + 12, window.innerWidth - W - 8)
      const y = Math.max(8, Math.min(r.top - 8, window.innerHeight - 270))
      setAt({ x, y })
    }, DELAY)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setAt(null)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const c = children.props
  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { c.onMouseEnter?.(e); show(e.currentTarget) },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { c.onMouseLeave?.(e); hide() },
        onMouseDown: (e: React.MouseEvent<HTMLElement>) => { c.onMouseDown?.(e); hide() },
        onFocus: (e: React.FocusEvent<HTMLElement>) => { c.onFocus?.(e); show(e.currentTarget) },
        onBlur: (e: React.FocusEvent<HTMLElement>) => { c.onBlur?.(e); hide() },
      })}
      {at && createPortal(
        <div className="rich-tip" style={{ left: at.x, top: at.y, width: W }} role="tooltip">
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
