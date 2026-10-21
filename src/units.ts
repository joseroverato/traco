import { useSyncExternalStore } from 'react'
import { fmtNum } from './i18n'

/**
 * Sistema de unidades de exibição. O projeto guarda e calcula tudo em metros (escalas, fórmulas, fatores);
 * no modo imperial só o que a pessoa vê e digita é convertido: m → ft, m² → ft², m³ → yd³.
 * Dinheiro não se converte: o total é o mesmo, o preço mostrado é por unidade exibida.
 */
export type UnitSystem = 'metric' | 'imperial'

export const FT_PER_M = 1 / 0.3048
export const FT2_PER_M2 = FT_PER_M * FT_PER_M
export const YD3_PER_M3 = 1 / 0.764554857984

const STORE = 'traco.units'
let system: UnitSystem = load()
const listeners = new Set<() => void>()

function load(): UnitSystem {
  try {
    const v = localStorage.getItem(STORE)
    if (v === 'metric' || v === 'imperial') return v
    // quem nunca escolheu: imperial só nos EUA (onde a prática de obra é em pés e polegadas)
    return typeof navigator !== 'undefined' && /^en-US$/i.test(navigator.language) ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export const getUnits = () => system
export function setUnits(u: UnitSystem) {
  system = u
  try { localStorage.setItem(STORE, u) } catch { /* vale só nesta sessão */ }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))
export const useUnits = () => useSyncExternalStore(subscribe, getUnits)

/** Fator de conversão da unidade guardada para a exibida (1 quando não há conversão). */
export function unitFactor(unit: string, sys: UnitSystem = system): number {
  if (sys !== 'imperial') return 1
  return unit === 'm' ? FT_PER_M : unit === 'm²' ? FT2_PER_M2 : unit === 'm³' ? YD3_PER_M3 : 1
}

export function unitName(unit: string, sys: UnitSystem = system): string {
  if (sys !== 'imperial') return unit
  return unit === 'm' ? 'ft' : unit === 'm²' ? 'ft²' : unit === 'm³' ? 'yd³' : unit
}

/** Valor e unidade como a pessoa vê. */
export const display = (value: number, unit: string, sys: UnitSystem = system) => ({ value: value * unitFactor(unit, sys), unit: unitName(unit, sys) })

/** "12,35 m²" (ou "132,93 ft²" no modo imperial). */
export function fmtQty(value: number, unit: string, d = 2): string {
  const x = display(value, unit)
  return `${fmtNum(x.value, d)} ${x.unit}`
}

/** Comprimento em metros → número no sistema exibido (para campos de edição) e de volta. */
export const lenIn = (m: number) => (system === 'imperial' ? m * FT_PER_M : m)
export const lenOut = (v: number) => (system === 'imperial' ? v / FT_PER_M : v)
export const lenUnit = () => unitName('m')

/** Medidas conhecidas que a pessoa digita ao calibrar uma escala, com o fator para metros. */
export const CALIB_UNITS: Record<UnitSystem, { id: string; toM: number }[]> = {
  metric: [{ id: 'm', toM: 1 }, { id: 'cm', toM: 0.01 }, { id: 'mm', toM: 0.001 }],
  imperial: [{ id: 'ft', toM: 0.3048 }, { id: 'in', toM: 0.0254 }],
}

/**
 * Lê uma medida digitada em pés e polegadas: 12'-6", 12' 6 1/2", 12.5', 150", 12 ft 6 in, 3/4".
 * Devolve metros, ou null se não entender. Número puro vale na unidade `bare`.
 */
export function parseLength(text: string, bare: 'm' | 'ft' | 'in' | 'cm' | 'mm' = 'm'): number | null {
  const s = text.trim().toLowerCase().replace(',', '.').replace(/[−–—]/g, '-')
  if (!s) return null
  const frac = (x: string): number | null => {
    const m = x.trim().match(/^(?:(\d+(?:\.\d+)?)[\s-]+)?(\d+)\s*\/\s*(\d+)$/) // "6 1/2" ou "1/2"
    if (m) return m[3] === '0' ? null : (m[1] ? Number(m[1]) : 0) + Number(m[2]) / Number(m[3])
    return /^\d+(?:\.\d+)?$/.test(x.trim()) ? Number(x) : null
  }
  const FT = /(?:'|ft|feet|foot|pés?)/, IN = /(?:"|in|inch(?:es)?|pol)/
  // pés e polegadas juntos: 12'-6 1/2"
  const both = s.match(new RegExp(`^([\\d.]+)\\s*${FT.source}[\\s-]*(.+?)\\s*(?:${IN.source})?$`))
  if (both && !/^\s*$/.test(both[2])) {
    const f = Number(both[1]), i = frac(both[2])
    if (Number.isFinite(f) && i !== null) return f * 0.3048 + i * 0.0254
  }
  const ftOnly = s.match(new RegExp(`^([\\d.]+)\\s*${FT.source}$`))
  if (ftOnly) return Number(ftOnly[1]) * 0.3048
  const inOnly = s.match(new RegExp(`^(.+?)\\s*${IN.source}$`))
  if (inOnly) {
    const i = frac(inOnly[1])
    return i === null ? null : i * 0.0254
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n * { m: 1, ft: 0.3048, in: 0.0254, cm: 0.01, mm: 0.001 }[bare]
}

/** Escalas de arquitetura (polegada = pé) e de engenharia (polegada = N pés), como razão 1:N. */
export const IMPERIAL_SCALES: { label: string; n: number }[] = [
  { label: '3" = 1\'-0"', n: 4 },
  { label: '1-1/2" = 1\'-0"', n: 8 },
  { label: '1" = 1\'-0"', n: 12 },
  { label: '3/4" = 1\'-0"', n: 16 },
  { label: '1/2" = 1\'-0"', n: 24 },
  { label: '3/8" = 1\'-0"', n: 32 },
  { label: '1/4" = 1\'-0"', n: 48 },
  { label: '3/16" = 1\'-0"', n: 64 },
  { label: '1/8" = 1\'-0"', n: 96 },
  { label: '1/16" = 1\'-0"', n: 192 },
  { label: '1" = 10\'', n: 120 },
  { label: '1" = 20\'', n: 240 },
  { label: '1" = 30\'', n: 360 },
  { label: '1" = 40\'', n: 480 },
  { label: '1" = 50\'', n: 600 },
]
