import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { reducedMotion } from '../motion'

/** Tempo da saída. Tem de ser igual a `--t-fast` no index.css. */
const EXIT_MS = 120

/**
 * Mantém o filho na tela por um instante depois que ele deixa de existir, com a classe `leaving`, para ele sair com um fade
 * em vez de sumir de uma vez (diálogos e aviso). Enquanto sai, fica inerte: não recebe clique nem foco.
 * A saída é mais curta que a entrada. Com "reduzir movimento", some na hora.
 */
export function Presence({ children }: { children: ReactNode }) {
  // último filho que chegou à tela. Só é gravado depois do commit: um render que suspende (módulo ainda carregando) não deixa resto
  const last = useRef<ReactNode>(null)
  const wasLeaving = useRef(false)
  const [gen, setGen] = useState(0)
  const [, redraw] = useState(0)
  const has = children !== null && children !== undefined && children !== false

  useLayoutEffect(() => {
    if (!has) {
      wasLeaving.current = !!last.current
      return
    }
    last.current = children
    // reaberto no meio da saída: monta de novo, para o foco e o estado interno recomeçarem como numa abertura normal
    if (wasLeaving.current) setGen((g) => g + 1)
    wasLeaving.current = false
  }, [has, children])

  useEffect(() => {
    if (has || !last.current) return
    const drop = () => {
      last.current = null
      wasLeaving.current = false
      redraw((n) => n + 1)
    }
    if (reducedMotion()) return drop()
    const timer = window.setTimeout(drop, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [has])

  const shown = has ? children : last.current
  if (!shown) return null
  return <div key={gen} className={has ? 'presence' : 'presence leaving'} inert={!has}>{shown}</div>
}
