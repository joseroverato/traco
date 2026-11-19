import { installSprite } from '../sprite'

/** Ícones próprios do Traço (rodada 3): o sprite e a troca de tema ficam em src/sprite.ts. */
interface IconProps { name: string; size?: number; className?: string }

/** Ícone de função. Sem título: o rótulo do comando fica no botão (todo controle tem texto legível). */
export function Icon({ name, size = 16, className }: IconProps) {
  installSprite()
  return (
    <svg className={`ic${className ? ' ' + className : ''}`} width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  )
}

/** Glifo de interface (setas, fechar, fixar…). */
export function Glyph({ name, size = 12, className }: IconProps) {
  installSprite()
  return (
    <svg className={`gl${className ? ' ' + className : ''}`} width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`#g-${name}`} />
    </svg>
  )
}
