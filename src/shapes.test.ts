import { describe, expect, it } from 'vitest'
import { shapePoints } from './shapes'
import { polyArea } from './geometry'

describe('formas para áreas', () => {
  it('retângulo: quatro cantos e a área do retângulo', () => {
    const p = shapePoints('rect', { x: 10, y: 20 }, { x: 40, y: 60 })
    expect(p).toHaveLength(4)
    expect(polyArea(p)).toBeCloseTo(30 * 40, 6)
  })
  it('retângulo arrastado para cima e para a esquerda também funciona', () => {
    expect(polyArea(shapePoints('rect', { x: 40, y: 60 }, { x: 10, y: 20 }))).toBeCloseTo(1200, 6)
  })
  it('Shift faz quadrado com o maior lado', () => {
    expect(polyArea(shapePoints('rect', { x: 0, y: 0 }, { x: 30, y: 10 }, true))).toBeCloseTo(900, 6)
  })
  it('círculo: a área bate com π·r² (o polígono é compensado)', () => {
    const p = shapePoints('circle', { x: 100, y: 100 }, { x: 130, y: 140 }) // raio 50
    expect(polyArea(p)).toBeCloseTo(Math.PI * 50 * 50, 3)
  })
  it('elipse: área π·a·b e, com Shift, círculo', () => {
    expect(polyArea(shapePoints('ellipse', { x: 0, y: 0 }, { x: 80, y: 40 }))).toBeCloseTo(Math.PI * 40 * 20, 3)
    expect(polyArea(shapePoints('ellipse', { x: 0, y: 0 }, { x: 80, y: 40 }, true))).toBeCloseTo(Math.PI * 40 * 40, 3)
  })
})
