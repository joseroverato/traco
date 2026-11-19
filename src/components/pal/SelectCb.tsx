import type { ReactNode } from 'react'
import { Glyph } from './../Icon'

/**
 * Lista suspensa fechada da base (.cb), com um <select> nativo transparente por cima: a aparência é a da maquete
 * e a lista aberta, o teclado e o leitor de tela são os do sistema.
 */
export function SelectCb({ value, onChange, label, current, children, className = '', lead, disabled }: {
  value: string
  onChange: (v: string) => void
  /** nome acessível do controle */
  label: string
  /** o que aparece no campo fechado */
  current: ReactNode
  children: ReactNode
  className?: string
  lead?: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={`cb sel ${className}`.trim()}>
      {lead}
      <span>{current}</span>
      <Glyph name="down" size={10} />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} disabled={disabled}>{children}</select>
    </label>
  )
}
