import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { addHole, buildDraft, commitDraw, commitFill, commitPolygon, minVertices, placeAt } from './viewerActions'
import { mk, preset, sheet, square } from './testUtils'

const st = () => useStore.getState()
const reset = (extra = {}) =>
  useStore.setState({ markups: [], sheets: [sheet()], past: [], future: [], selected: [], tool: 'rect', calibrating: null, editingText: null, toast: null, rightTab: 'presets', redactFill: '#000000', fillAs: 'area', holeTarget: null, activePreset: null, presets: [], solidDefaults: { color: '#2f9e8f', height: 2.8 }, ...extra })

describe('minVertices', () => {
  it('linha precisa de 2 pontos; área, ambiente e vazio de 3', () => {
    expect(minVertices('length')).toBe(2)
    expect(minVertices('area')).toBe(3)
    expect(minVertices('space')).toBe(3)
    expect(minVertices('hole')).toBe(3)
  })
})

describe('commitPolygon / addHole', () => {
  beforeEach(() => reset())

  it('comprimento e área viram marcações da folha', () => {
    commitPolygon('length', 's1', [{ x: 0, y: 0 }, { x: 10, y: 0 }])
    commitPolygon('area', 's1', square(10))
    expect(st().markups.map((m) => m.kind)).toEqual(['length', 'area'])
  })

  it('ambiente recebe nome sequencial, fica selecionado e abre as propriedades', () => {
    commitPolygon('space', 's1', square(10))
    commitPolygon('space', 's1', square(10, 50, 50))
    const [a, b] = st().markups
    expect([a.text, b.text]).toEqual(['Ambiente 1', 'Ambiente 2'])
    expect(st().selected).toEqual([b.id])
    expect(st().rightTab).toBe('props')
    expect(st().panels.right).toBe(true)
  })

  it('sólido nasce com nome sequencial, base 0 e pé-direito, e abre as propriedades', () => {
    commitPolygon('solid', 's1', square(10))
    commitPolygon('solid', 's1', square(10, 50, 50))
    const [a, b] = st().markups
    expect([a.kind, a.text, a.base, a.height]).toEqual(['solid', 'Sólido 1', 0, 2.8])
    expect(b.text).toBe('Sólido 2')
    expect(st().selected).toEqual([b.id])
    expect(st().rightTab).toBe('props')
  })

  it('o próximo sólido nasce com a cor e a altura do último ajustado', () => {
    commitPolygon('solid', 's1', square(10))
    expect(st().markups[0]).toMatchObject({ height: 2.8, color: '#2f9e8f' })
    st().rememberSolid({ height: 4.2, color: '#aa3366' })
    commitPolygon('solid', 's1', square(10, 50, 50))
    expect(st().markups[1]).toMatchObject({ height: 4.2, color: '#aa3366', fill: '#aa3366' })
    expect(st().markups[0].height).toBe(2.8) // os existentes não mudam
  })

  it('rememberSolid ignora valores inválidos', () => {
    st().rememberSolid({ height: 3 })
    st().rememberSolid({ height: -1, color: '' })
    st().rememberSolid({ height: Number.NaN })
    expect(st().solidDefaults.height).toBe(3)
    expect(st().solidDefaults.color).toBe('#2f9e8f')
  })

  it('vazio entra na menor área que o contém e seleciona essa área', () => {
    const big = mk({ id: 'big', kind: 'area', points: square(1000) })
    const small = mk({ id: 'small', kind: 'area', points: square(200) })
    useStore.setState({ markups: [big, small] })
    commitPolygon('hole', 's1', square(20, 50, 50))
    expect(st().markups.find((m) => m.id === 'small')!.holes).toHaveLength(1)
    expect(st().markups.find((m) => m.id === 'big')!.holes).toBeUndefined()
    expect(st().selected).toEqual(['small'])
  })

  it('vazio fora de qualquer área só avisa e não altera nada', () => {
    const area = mk({ id: 'a', kind: 'area', points: square(100) })
    useStore.setState({ markups: [area] })
    addHole('s1', square(10, 5000, 5000))
    expect(st().markups).toEqual([area])
    expect(st().toast).toMatch(/dentro de uma área/)
  })
})

describe('commitFill', () => {
  beforeEach(() => reset())

  it('cria área com os vazios descontados e avisa quantos', () => {
    commitFill('s1', square(100), [square(10, 20, 20)], false)
    const [m] = st().markups
    expect(m.kind).toBe('area')
    expect(m.holes).toHaveLength(1)
    expect(st().selected).toEqual([m.id])
    expect(st().toast).toMatch(/1 vazio/)
  })

  it('sem vazios não coloca o campo holes', () => {
    commitFill('s1', square(100), [], false)
    expect(st().markups[0].holes).toBeUndefined()
  })

  it('no modo ambiente cria um ambiente e abre as propriedades', () => {
    useStore.setState({ fillAs: 'space' })
    commitFill('s1', square(100), [], false)
    expect(st().markups[0].kind).toBe('space')
    expect(st().markups[0].text).toBe('Ambiente 1')
    expect(st().rightTab).toBe('props')
  })

  it('Shift+clique (asHole) desconta da área existente', () => {
    useStore.setState({ markups: [mk({ id: 'a', kind: 'area', points: square(500) })] })
    commitFill('s1', square(40, 100, 100), [], true)
    expect(st().markups).toHaveLength(1)
    expect(st().markups[0].holes).toHaveLength(1)
  })
})

describe('commitDraw', () => {
  beforeEach(() => reset())
  const a = { x: 10, y: 10 }
  const b = { x: 110, y: 10 }

  it('calibrar pede a escala com o comprimento traçado e volta à seleção', () => {
    commitDraw('calibrate', 's1', a, b)
    expect(st().calibrating).toEqual({ page: 's1', length: 100, viewport: undefined })
    expect(st().tool).toBe('select')
    expect(st().markups).toHaveLength(0)
  })

  it('calibrar dentro de um viewport calibra só ele', () => {
    const vp = mk({ id: 'vp', kind: 'viewport', points: [{ x: 0, y: 0 }, { x: 500, y: 500 }] })
    useStore.setState({ markups: [vp] })
    commitDraw('calibrate', 's1', a, b)
    expect(st().calibrating?.viewport).toBe('vp')
  })

  it('viewport é criado com nome sequencial e já pede a escala dele', () => {
    commitDraw('viewport', 's1', a, { x: 200, y: 200 })
    commitDraw('viewport', 's1', a, { x: 300, y: 300 })
    const vps = st().markups.filter((m) => m.kind === 'viewport')
    expect(vps.map((m) => m.text)).toEqual(['Viewport 1', 'Viewport 2'])
    expect(st().calibrating).toEqual({ page: 's1', length: 0, viewport: vps[1].id })
  })

  it('tarja preta não abre propriedades; branca (corrigir texto) abre e seleciona', () => {
    commitDraw('redact', 's1', a, { x: 110, y: 30 })
    expect(st().markups[0]).toMatchObject({ kind: 'redact', fill: '#000000', fillOpacity: 1, fontSize: 12 })
    expect(st().rightTab).toBe('presets')
    useStore.setState({ redactFill: '#ffffff' })
    commitDraw('redact', 's1', a, { x: 110, y: 30 })
    expect(st().rightTab).toBe('props')
    expect(st().selected).toEqual([st().markups[1].id])
  })

  it.each(['cloud', 'rect', 'ellipse', 'arrow', 'line'] as const)('%s (item de revisão) abre as propriedades', (kind) => {
    commitDraw(kind, 's1', a, b)
    expect(st().markups[0].kind).toBe(kind)
    expect(st().selected).toEqual([st().markups[0].id])
    expect(st().rightTab).toBe('props')
  })
})

describe('placeAt', () => {
  beforeEach(() => reset())

  it('carimbo nasce centrado no clique com o texto padrão e abre a edição', () => {
    placeAt('stamp', 's1', { x: 100, y: 100 })
    const m = st().markups[0]
    expect(m.kind).toBe('stamp')
    expect(m.text).toBe('REVISADO\n{data}')
    expect(m.points).toEqual([{ x: 10, y: 78 }, { x: 190, y: 122 }])
    expect(st().editingText).toBe(m.id)
    expect(st().tool).toBe('select')
  })

  it('texto abre a edição', () => {
    placeAt('text', 's1', { x: 5, y: 5 })
    expect(st().markups[0].kind).toBe('text')
    expect(st().editingText).toBe(st().markups[0].id)
  })

  it('legenda volta à seleção e abre as propriedades', () => {
    placeAt('legend', 's1', { x: 5, y: 5 })
    const m = st().markups[0]
    expect(m.legend).toEqual({ scope: 'sheet', prices: false })
    expect(st().tool).toBe('select')
    expect(st().selected).toEqual([m.id])
    expect(st().rightTab).toBe('props')
  })
})

describe('buildDraft', () => {
  beforeEach(() => reset())

  it('usa cor, espessura e preenchimento do marcador ativo do mesmo tipo', () => {
    const p = preset({ id: 'p', measure: 'area', color: '#12a594', width: 3, opacity: 0.4 })
    reset({ presets: [p], activePreset: 'p' })
    const d = buildDraft('area', square(10), 's1', 1)
    expect(d).toMatchObject({ id: '__draft', color: '#12a594', width: 3, fillOpacity: 0.4, presetId: 'p' })
  })

  it('marcador de outro tipo é ignorado', () => {
    const p = preset({ id: 'p', measure: 'length', color: '#12a594' })
    reset({ presets: [p], activePreset: 'p' })
    expect(buildDraft('area', square(10), 's1', 1)).toMatchObject({ color: '#e5484d', presetId: null, fillOpacity: 0.2 })
  })

  it('calibração é uma linha azul com espessura constante na tela', () => {
    const d = buildDraft('calibrate', [{ x: 0, y: 0 }, { x: 5, y: 5 }], 's1', 2)
    expect(d).toMatchObject({ kind: 'line', color: '#0090ff', width: 0.75 })
  })
})
