import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

interface Props {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  /** Sufixo do valor mostrado na bolha (ex.: "°", " pt"). Intervalos até 1 viram porcentagem. */
  unit?: string
  label?: string
}

const MAX_TICKS = 41

/**
 * Controle deslizante em barras verticais (estilo "régua"): as barras até o valor ficam na cor de acento, as próximas ao dedo crescem
 * e uma bolha com o valor acompanha o cursor. Funciona com mouse, toque e teclado (setas, Home/End, PageUp/PageDown).
 */
export function TickSlider({ min, max, step, value, onChange, unit = '', label }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState<number | null>(null)
  const [active, setActive] = useState(false)

  const steps = Math.max(1, Math.round((max - min) / step))
  const n = Math.min(steps + 1, MAX_TICKS)
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const snap = (v: number) => clamp(Math.round((v - min) / step) * step + min)
  const ratio = (value - min) / (max - min || 1)
  const pct = max <= 1 && min >= 0 ? true : false
  const fmt = (v: number) => (pct ? `${Math.round(v * 100)}%` : `${Number.isInteger(v) ? v : v.toFixed(2).replace(/\.?0+$/, '')}${unit}`)
  const decimals = (step.toString().split('.')[1] ?? '').length
  const round = (v: number) => Number(v.toFixed(decimals))

  const at = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const set = (e: PointerEvent) => {
    const x = at(e)
    setNear(x)
    onChange(round(snap(min + x * (max - min))))
  }
  const onKey = (e: KeyboardEvent) => {
    const big = step * Math.max(1, Math.round(steps / 10))
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : e.key === 'PageUp' ? big : e.key === 'PageDown' ? -big : 0
    if (e.key === 'Home') onChange(min)
    else if (e.key === 'End') onChange(max)
    else if (d) onChange(round(snap(value + d)))
    else return
    e.preventDefault()
  }

  const focusX = near ?? ratio
  return (
    <div
      ref={box}
      className={`tickslider ${active ? 'active' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={fmt(value)}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setActive(true)
        set(e)
      }}
      onPointerMove={(e) => {
        if (active) set(e)
        else setNear(at(e))
      }}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      onPointerLeave={() => !active && setNear(null)}
    >
      <div className="ticks" aria-hidden>
        {Array.from({ length: n }, (_, i) => {
          const x = n === 1 ? 0 : i / (n - 1)
          const on = x <= ratio + 1e-9
          // as barras perto do ponteiro (ou do valor) crescem, como uma lupa
          const d = Math.abs(x - focusX)
          const grow = Math.exp(-(d * d) / 0.012)
          return <i key={i} className={on ? 'on' : ''} style={{ ['--g' as string]: grow.toFixed(3) }} />
        })}
      </div>
      <b className="bubble-val" style={{ left: `${ratio * 100}%` }} aria-hidden>{fmt(value)}</b>
    </div>
  )
}
