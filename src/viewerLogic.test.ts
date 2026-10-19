import { describe, expect, it } from 'vitest'
import { DRAWING_TOOLS, MAX_ZOOM, MIN_ZOOM, PAD, clampZoom, computeLayout, fitStampBox, fitZoom, markupsInRect, pickHoleTarget, redactFontSize, wheelFactor, zoomStep } from './viewerLogic'
import { mk, square } from './testUtils'

describe('computeLayout', () => {
  it('centraliza a folha quando ela é menor que a área', () => {
    const l = computeLayout({ width: 100, height: 50 }, { w: 800, h: 600 }, 2)
    expect(l.pw).toBe(200)
    expect(l.ph).toBe(100)
    expect(l.sw).toBe(800)
    expect(l.left).toBe(300)
    expect(l.top).toBe(250)
  })

  it('cresce a área rolável (com margem) quando a folha é maior', () => {
    const l = computeLayout({ width: 1000, height: 1000 }, { w: 800, h: 600 }, 1)
    expect(l.sw).toBe(1000 + PAD * 2)
    expect(l.left).toBe(PAD)
    expect(l.top).toBe(PAD)
  })

  it('sem folha devolve tamanho zero', () => {
    const l = computeLayout(undefined, { w: 800, h: 600 }, 1)
    expect([l.pw, l.ph]).toEqual([0, 0])
  })
})

describe('fitZoom', () => {
  const sheet = { width: 1000, height: 500 }
  const area = { w: 1000 + PAD * 2 + 16, h: 400 }
  it('largura: encaixa só pela largura', () => {
    expect(fitZoom('width', area, sheet)).toBeCloseTo(1)
  })
  it('folha inteira: usa a menor razão (altura aqui)', () => {
    expect(fitZoom('page', area, sheet)).toBeCloseTo((400 - PAD * 2 - 16) / 500)
  })
  it('nunca fica abaixo do zoom mínimo', () => {
    expect(fitZoom('page', { w: 10, h: 10 }, sheet)).toBe(MIN_ZOOM)
  })
})

describe('zoom', () => {
  it('roda para cima aproxima, para baixo afasta, e ctrl é mais forte', () => {
    expect(wheelFactor(-100, 0, false)).toBeGreaterThan(1)
    expect(wheelFactor(100, 0, false)).toBeLessThan(1)
    expect(wheelFactor(-10, 0, true)).toBeGreaterThan(wheelFactor(-10, 0, false))
  })
  it('limita saltos enormes e converte linhas em pixels', () => {
    expect(wheelFactor(-5000, 0, false)).toBeCloseTo(wheelFactor(-300, 0, false))
    expect(wheelFactor(-3, 1, false)).toBeCloseTo(wheelFactor(-99, 0, false))
  })
  it('clampZoom respeita os limites', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM)
    expect(clampZoom(1000)).toBe(MAX_ZOOM)
    expect(clampZoom(2)).toBe(2)
  })
  it('zoomStep converge ao alvo e termina', () => {
    let z = 1
    let steps = 0
    for (; steps < 200; steps++) {
      const r = zoomStep(z, 4)
      z = r.zoom
      if (r.done) break
    }
    expect(z).toBe(4)
    expect(steps).toBeLessThan(60)
  })
  it('zoomStep nunca passa do alvo', () => {
    const r = zoomStep(1, 2)
    expect(r.zoom).toBeGreaterThan(1)
    expect(r.zoom).toBeLessThan(2)
  })
})

describe('markupsInRect', () => {
  const a = mk({ id: 'a', page: 's1', points: square(10) })
  const b = mk({ id: 'b', page: 's1', points: square(10, 100, 100) })
  const c = mk({ id: 'c', page: 's2', points: square(10) })
  it('pega as que tocam o retângulo, só da folha atual', () => {
    expect(markupsInRect([a, b, c], 's1', { x: 5, y: 5, w: 20, h: 20 })).toEqual(['a'])
    expect(markupsInRect([a, b, c], 's1', { x: 0, y: 0, w: 500, h: 500 })).toEqual(['a', 'b'])
  })
  it('ignora marcações sem pontos', () => {
    expect(markupsInRect([mk({ id: 'z', points: [] })], 's1', { x: 0, y: 0, w: 9, h: 9 })).toEqual([])
  })
})

describe('pickHoleTarget', () => {
  const big = mk({ id: 'big', kind: 'area', points: square(1000) })
  const small = mk({ id: 'small', kind: 'area', points: square(200) })
  const hole = square(20, 50, 50)
  it('escolhe a menor área que contém o vazio', () => {
    expect(pickHoleTarget([big, small], 's1', hole, null, [])?.id).toBe('small')
  })
  it('prefere a selecionada e depois o alvo explícito', () => {
    expect(pickHoleTarget([big, small], 's1', hole, null, ['big'])?.id).toBe('big')
    expect(pickHoleTarget([big, small], 's1', hole, 'big', ['small'])?.id).toBe('big')
  })
  it('sem área em volta devolve undefined', () => {
    expect(pickHoleTarget([big], 's1', square(20, 5000, 5000), null, [])).toBeUndefined()
  })
})

describe('caixas', () => {
  it('fitStampBox mantém o centro e cresce com o texto', () => {
    const base = [{ x: 0, y: 0 }, { x: 100, y: 40 }]
    const [p, q] = fitStampBox('REVISADO\n{data}', 14, base)
    expect((p.x + q.x) / 2).toBeCloseTo(50)
    expect((p.y + q.y) / 2).toBeCloseTo(20)
    const longText = fitStampBox('um texto bem mais comprido que o anterior', 14, base)
    expect(longText[1].x - longText[0].x).toBeGreaterThan(q.x - p.x)
  })
  it('fitStampBox tem largura mínima', () => {
    const [p, q] = fitStampBox('a', 10, [{ x: 0, y: 0 }, { x: 10, y: 10 }])
    expect(q.x - p.x).toBe(60)
  })
  it('redactFontSize fica entre 6 e 24', () => {
    expect(redactFontSize({ x: 0, y: 0 }, { x: 10, y: 5 })).toBe(6)
    expect(redactFontSize({ x: 0, y: 0 }, { x: 10, y: 20 })).toBe(12)
    expect(redactFontSize({ x: 0, y: 0 }, { x: 10, y: 500 })).toBe(24)
    expect(redactFontSize({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(9)
  })
  it('ferramentas de desenho incluem medição e excluem seleção/mão', () => {
    expect(DRAWING_TOOLS).toContain('length')
    expect(DRAWING_TOOLS).not.toContain('select')
    expect(DRAWING_TOOLS).not.toContain('pan')
  })
})
