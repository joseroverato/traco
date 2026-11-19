import { useCallback, useState } from 'react'
import { ContextMenu } from '../ContextMenu'
import type { MenuItem } from '../ContextMenu'

/** Menu de contexto de uma paleta: `open(x, y, itens)` mostra, e `element` vai no fim do JSX. */
export function useMenu() {
  const [m, setM] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const close = useCallback(() => setM(null), [])
  const open = useCallback((x: number, y: number, items: MenuItem[]) => setM({ x, y, items }), [])
  return { open, element: m ? <ContextMenu x={m.x} y={m.y} items={m.items} onClose={close} /> : null }
}
