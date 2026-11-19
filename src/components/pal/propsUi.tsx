import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { Glyph } from '../Icon'
import { HintCtx } from './hintCtx'


/** Categorias recolhidas (por nome): lembra entre uma seleção e outra. */
const ShutCtx = createContext<{ shut: Record<string, boolean>; toggle: (id: string) => void }>({ shut: {}, toggle: () => {} })
export function ShutProvider({ children }: { children: ReactNode }) {
  const [shut, setShut] = useState<Record<string, boolean>>({})
  return <ShutCtx.Provider value={{ shut, toggle: (id) => setShut((o) => ({ ...o, [id]: !o[id] })) }}>{children}</ShutCtx.Provider>
}

/** Categoria recolhível da grade (.pc), com botão opcional no fim da barra. */
export function Cat({ id, title, count, action, children }: { id: string; title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  const { shut, toggle } = useContext(ShutCtx)
  const closed = !!shut[id]
  return (
    <div className="pc" role="rowgroup">
      <div className="pc-h">
        <button type="button" className="pc-t" aria-expanded={!closed} onClick={() => toggle(id)}>
          <Glyph name={closed ? 'right' : 'down'} size={10} />
          <span>{title}{count != null && <em className="cnt">{count}</em>}</span>
        </button>
        {action}
      </div>
      {!closed && children}
    </div>
  )
}

/** Linha da grade: rótulo (.pk) + valor (.pv). `ed` = linha editável; `hint` aparece na descrição do pé. */
export function Row({ k, children, ed, sub, wr, hint }: { k: string; children: ReactNode; ed?: boolean; sub?: boolean; wr?: boolean; hint?: string }) {
  const setHint = useContext(HintCtx)
  const show = () => setHint(hint ? { title: k, text: hint } : null)
  return (
    <div className={`pr${ed ? ' ed' : ''}${sub ? ' sub' : ''}`} role="row" onMouseEnter={show} onFocusCapture={show}>
      <span className="pk" role="rowheader">{k}</span>
      <span className={`pv${wr ? ' wr' : ''}`} role="cell">{children}</span>
    </div>
  )
}
