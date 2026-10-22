import { describe, expect, it } from 'vitest'
import { contrast, derive, hexToOklch, oklchToHex } from './theme'

const SAMPLE = ['#4d8dff', '#ff0000', '#00ff00', '#ffff00', '#ffffff', '#000000', '#7f7f7f', '#8b7bff', '#ff5d9e', '#ffc247', '#2ec5c5', '#123456']

describe('cores personalizáveis', () => {
  it('ida e volta OKLCH mantém a cor', () => {
    for (const h of ['#4d8dff', '#ff5d9e', '#3ecf8e', '#808080']) {
      const back = oklchToHex(hexToOklch(h))
      expect(contrast(h, back)).toBeLessThan(1.02)
    }
  })

  it('o texto sobre o acento tem contraste de pelo menos 4,5:1, em qualquer cor e tema', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const accent of SAMPLE) {
        const d = derive(theme, { primary: null, accent })
        expect(d.onAccent, `${theme} ${accent}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('o acento como texto sobre o painel tem contraste de pelo menos 4,5:1', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const accent of SAMPLE) {
        const d = derive(theme, { primary: '#5b6b8c', accent })
        expect(d.accentText, `${theme} ${accent}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('a cor principal só dá o tom: o texto padrão continua legível sobre as superfícies', () => {
    const text = { dark: '#ececef', light: '#17181b' }
    for (const theme of ['dark', 'light'] as const) {
      for (const primary of ['#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ffffff', '#000000']) {
        const v = derive(theme, { primary, accent: null }).vars
        for (const k of ['--bg', '--canvas', '--panel', '--panel-2', '--raise']) expect(contrast(text[theme], v[k]), `${theme} ${primary} ${k}`).toBeGreaterThanOrEqual(7)
      }
    }
  })

  it('sem cores escolhidas, não mexe em nada', () => {
    expect(derive('dark', { primary: null, accent: null }).vars).toEqual({})
  })

  it('ignora valores que não são cor', () => {
    expect(derive('dark', { primary: 'red', accent: 'azul' }).vars).toEqual({})
  })
})
