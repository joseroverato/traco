import { createContext } from 'react'

/** Descrição da propriedade sob o cursor (a faixa `.ds` no pé da paleta). */
export interface Hint { title: string; text: string }
export const HintCtx = createContext<(h: Hint | null) => void>(() => {})
