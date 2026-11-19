import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { useDialogA11y } from '../dialogA11y'
import { Glyph } from './Icon'
import { t } from '../i18n'

/**
 * Casca de diálogo da rodada 3: véu (.rx.veu) + diálogo (.dlg) com título, abas opcionais, corpo e rodapé.
 * Foco preso, Esc e devolução do foco vêm de useDialogA11y. Clicar no véu fecha, como antes.
 * Largura: `width` em px, limitada pela janela. `fix` dá o tamanho fixo das Configurações (960 x 592).
 */
export function Dlg({ title, onClose, children, footer, tabs, lead, width = 560, fix, className = '', bodyClass = '', role = 'dialog', onKeyDown }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  tabs?: ReactNode
  /** peça antes do título (amostra do marcador) */
  lead?: ReactNode
  width?: number
  fix?: boolean
  className?: string
  bodyClass?: string
  role?: 'dialog' | 'alertdialog'
  /** teclas extras da janela (Enter para salvar); roda depois do tratamento de Tab e Esc */
  onKeyDown?: (e: KeyboardEvent) => void
}) {
  const a11y = useDialogA11y(onClose)
  return (
    <div className="rx veu" onMouseDown={onClose}>
      <div
        className={`dlg ${fix ? 'fix' : ''} ${className}`.trim()}
        style={fix ? undefined : { width: `min(${width}px, calc(100vw - 32px))` }}
        onMouseDown={(e) => e.stopPropagation()}
        {...a11y}
        role={role}
        onKeyDown={(e) => { a11y.onKeyDown(e); if (!e.defaultPrevented) onKeyDown?.(e) }}
      >
        <header className="dlg-t">
          {lead}
          <h2 data-dlg-title>{title}</h2>
          <button className="ib" type="button" onClick={onClose} aria-label={t('dialogs.fechar')} title={t('dialogs.fechar')}><Glyph name="x" size={12} /></button>
        </header>
        {tabs}
        <div className={`dlg-b rol ${bodyClass}`.trim()}>{children}</div>
        {footer && <footer className="dlg-f">{footer}</footer>}
      </div>
    </div>
  )
}

/** Abas do diálogo (.dtabs). */
export function DTabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const move = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = tabs[(i + d + tabs.length) % tabs.length]
    onChange(n.id)
    ;(e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-tab="${n.id}"]`))?.focus()
  }
  return (
    <div className="dtabs" role="tablist" aria-label={label}>
      {tabs.map((x, i) => (
        <button key={x.id} type="button" role="tab" data-tab={x.id} aria-selected={value === x.id} tabIndex={value === x.id ? 0 : -1} className={value === x.id ? 'on' : ''} onClick={() => onChange(x.id)} onKeyDown={(e) => move(e, i)}>{x.label}</button>
      ))}
    </div>
  )
}

/** Caixa de marcar (.ck) com o texto ao lado. */
export function Chk({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="opc">
      <input type="checkbox" className="ck" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

/** Botão de opção (.rd) com o texto ao lado. */
export function Rad({ checked, onChange, children, name, disabled }: { checked: boolean; onChange: () => void; children: ReactNode; name: string; disabled?: boolean }) {
  return (
    <label className="opc">
      <input type="radio" className="rd" name={name} checked={checked} disabled={disabled} onChange={onChange} />
      <span>{children}</span>
    </label>
  )
}

/** Campo de cor da base (.cor): amostra e valor; o seletor do sistema abre ao clicar. */
export function ColorField({ value, onChange, label, text, className = '' }: { value: string; onChange: (v: string) => void; label: string; text?: string; className?: string }) {
  return (
    <label className={`cor ${className}`.trim()}>
      <i className="cz" style={{ background: value }} />
      {text !== '' && <span className="n">{text ?? value.toUpperCase()}</span>}
      <input type="color" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length

/** Controle deslizante da base (.sld): trilho, graduação e alça. Mouse, toque e teclado (setas, Home, End). */
export function Sld({ value, min, max, step, onChange, label, valueText }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string; valueText?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const span = max - min || 1
  const pct = Math.min(100, Math.max(0, ((value - min) / span) * 100))
  const marks = Math.min(Math.round(span / step), 16)
  const dec = decimals(step)
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const snap = (v: number) => clamp(Number((Math.round((v - min) / step) * step + min).toFixed(dec)))
  const at = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    onChange(snap(min + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * span))
  }
  const key = (e: KeyboardEvent) => {
    const big = Math.max(step, span / 10)
    const to = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? value + step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? value - step : e.key === 'PageUp' ? value + big : e.key === 'PageDown' ? value - big : e.key === 'Home' ? min : e.key === 'End' ? max : null
    if (to === null) return
    e.preventDefault()
    onChange(snap(to))
  }
  return (
    <span
      ref={box}
      className="sld"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e) }}
      onPointerMove={(e) => { if (e.buttons) at(e) }}
      onKeyDown={key}
    >
      <i style={{ width: `${pct}%` }} />
      {Array.from({ length: marks + 1 }, (_, k) => <u key={k} style={{ left: `${(k / marks) * 100}%` }} />)}
      <b style={{ left: `${pct}%` }} />
    </span>
  )
}
