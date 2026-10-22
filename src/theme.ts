import { create } from 'zustand'

/**
 * Cores personalizáveis, no espírito do Material You (Android):
 *  - cor principal: dá o tom das superfícies (fundo, painéis, bordas), sempre discreto para o texto continuar legível;
 *  - cor de acento: botões, seleções e destaques. O texto sobre ela (branco ou escuro) e o texto colorido sobre os painéis
 *    são calculados para ter contraste mínimo de 4,5:1 (WCAG AA), qualquer que seja a cor escolhida.
 * As contas são feitas em OKLCH, onde a luminosidade percebida é uniforme.
 */
export type ThemeName = 'dark' | 'light'
export interface Palette { primary: string | null; accent: string | null }

const KEY = 'traco.palette'
const HEX = /^#[0-9a-f]{6}$/i

// ---------- conversões ----------
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const hexToRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')

export interface Lch { l: number; c: number; h: number }

export function hexToOklch(hex: string): Lch {
  const [r, g, b] = hexToRgb(hex).map(toLin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI }
}

function oklchToLinear({ l, c, h }: Lch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_]
}

/** OKLCH → hex. Se a cor não cabe no sRGB, reduz o croma (a cor fica mais suave, mas a luminosidade é mantida). */
export function oklchToHex(x: Lch): string {
  let c = x.c
  for (let i = 0; i < 24; i++) {
    const [r, g, b] = oklchToLinear({ ...x, c })
    if ([r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4)) return rgbToHex(toSrgb(Math.max(0, r)), toSrgb(Math.max(0, g)), toSrgb(Math.max(0, b)))
    c *= 0.93
  }
  return rgbToHex(...(oklchToLinear({ ...x, c: 0 }).map(toSrgb) as [number, number, number]))
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(toLin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a: string, b: string) {
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const WHITE = '#ffffff'
const DARK_ON = '#0b0b0d'
const MIN = 4.5

// ---------- derivação ----------
const SURF = {
  dark: { bg: 0.175, canvas: 0.205, panel: 0.235, 'panel-2': 0.265, raise: 0.305, line: 0.345, 'line-soft': 0.29 },
  light: { bg: 0.915, canvas: 0.89, panel: 0.985, 'panel-2': 0.965, raise: 0.94, line: 0.895, 'line-soft': 0.93 },
} as const

export interface Derived {
  vars: Record<string, string>
  /** Contraste do texto sobre o botão de acento, e do texto colorido sobre o painel. */
  onAccent?: number
  accentText?: number
}

export function derive(theme: ThemeName, p: Palette): Derived {
  const vars: Record<string, string> = {}
  const out: Derived = { vars }
  const dark = theme === 'dark'

  let panel = ''
  if (p.primary && HEX.test(p.primary)) {
    const base = hexToOklch(p.primary)
    // as superfícies só carregam um tom: croma baixo, luminosidade fixa (é ela que garante o contraste do texto)
    const c = Math.min(0.045, Math.max(0.012, base.c * 0.22)) * (dark ? 1 : 0.7)
    for (const [k, l] of Object.entries(SURF[theme])) vars[`--${k}`] = oklchToHex({ l, c, h: base.h })
    panel = vars['--panel']
  }
  const panelHex = panel || (dark ? '#232326' : '#fbfbfc')

  if (p.accent && HEX.test(p.accent)) {
    const a = hexToOklch(p.accent)
    let fill = oklchToHex(a)
    // o botão precisa se destacar do painel (3:1 para elementos de interface)
    for (let i = 0; i < 30 && contrast(fill, panelHex) < 3; i++) fill = oklchToHex({ ...a, l: Math.min(0.92, Math.max(0.2, a.l + (dark ? 1 : -1) * 0.02 * (i + 1))) })
    const on = contrast(WHITE, fill) >= MIN ? WHITE : DARK_ON
    // acento usado como texto/ícone sobre o painel
    const af = hexToOklch(fill)
    let text = fill
    for (let i = 0; i < 40 && contrast(text, panelHex) < MIN; i++) text = oklchToHex({ ...af, l: Math.min(0.95, Math.max(0.1, af.l + (dark ? 1 : -1) * 0.015 * (i + 1))) })
    const [r, g, b] = hexToRgb(fill).map((v) => Math.round(v * 255))
    vars['--accent'] = fill
    vars['--on-accent'] = on
    vars['--accent-text'] = text
    vars['--accent-soft'] = `rgba(${r}, ${g}, ${b}, ${dark ? 0.16 : 0.12})`
    out.onAccent = contrast(on, fill)
    out.accentText = contrast(text, panelHex)
  }
  return out
}

// ---------- estado e aplicação ----------
const ALL = ['--bg', '--canvas', '--panel', '--panel-2', '--raise', '--line', '--line-soft', '--accent', '--on-accent', '--accent-text', '--accent-soft']

function load(): Palette {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Palette> | null
    return { primary: v?.primary && HEX.test(v.primary) ? v.primary : null, accent: v?.accent && HEX.test(v.accent) ? v.accent : null }
  } catch {
    return { primary: null, accent: null }
  }
}

export const usePalette = create<Palette & { set: (p: Partial<Palette>) => void; reset: () => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p)
    const { primary, accent } = get()
    try {
      localStorage.setItem(KEY, JSON.stringify({ primary, accent }))
    } catch {
      /* sem storage */
    }
  },
  reset: () => get().set({ primary: null, accent: null }),
}))

const currentTheme = (): ThemeName => {
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  try {
    return JSON.parse(localStorage.getItem('traco.theme') ?? '"dark"') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Aplica a paleta ao documento. Sem cores escolhidas, remove tudo e o CSS padrão volta a valer. */
export function applyPalette(theme: ThemeName = currentTheme(), p: Palette = usePalette.getState()) {
  const st = document.documentElement.style
  const { vars } = derive(theme, p)
  for (const k of ALL) {
    if (vars[k]) st.setProperty(k, vars[k])
    else st.removeProperty(k)
  }
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', vars['--bg'] ?? (theme === 'dark' ? '#161618' : '#e4e6ea'))
}

// aplica antes da primeira pintura (o módulo é importado no começo do main.tsx)
if (typeof document !== 'undefined') applyPalette()
