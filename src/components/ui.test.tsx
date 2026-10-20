// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { paperScale } from '../geometry'
import { useStore } from '../store'
import { sheet } from '../testUtils'
import { ViewerEmpty } from './ViewerEmpty'
import { DashedRect, SearchHighlights, SelectionHandles } from './ViewerOverlays'
import { ScaleBanner } from './ScaleBanner'
import { Tour } from './Tour'

vi.mock('../project', () => ({ loadFile: vi.fn() })) // o passo a passo importa o carregador de PDF (pesado, não é o que se testa aqui)

afterEach(cleanup)

describe('ViewerEmpty (tela inicial)', () => {
  const props = () => ({ boxRef: createRef<HTMLDivElement>(), dragOver: false, setDragOver: vi.fn(), onDrop: vi.fn(), onOpen: vi.fn(), onSample: vi.fn() })

  it('oferece abrir um PDF e experimentar com a planta de exemplo', () => {
    const p = props()
    render(<ViewerEmpty {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir PDF' }))
    fireEvent.click(screen.getByRole('button', { name: /planta de exemplo/ }))
    expect(p.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onSample).toHaveBeenCalledTimes(1)
  })

  it('marca a área ao arrastar um arquivo por cima e entrega o drop', () => {
    const p = props()
    const { container } = render(<ViewerEmpty {...p} />)
    const area = container.querySelector('.viewer')!
    fireEvent.dragOver(area)
    expect(p.setDragOver).toHaveBeenCalledWith(true)
    fireEvent.drop(area)
    expect(p.onDrop).toHaveBeenCalledTimes(1)
  })

  it('mostra o estado de arrastar', () => {
    const { container } = render(<ViewerEmpty {...props()} dragOver />)
    expect(container.querySelector('.viewer')!.className).toContain('drag')
  })
})

describe('camadas do SVG da folha', () => {
  it('alças: uma por vértice, com tamanho inversamente proporcional ao zoom', () => {
    const { container } = render(<svg><SelectionHandles sel={{ id: 'm1', points: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 40 }] }} zoom={2} /></svg>)
    const hs = container.querySelectorAll('rect[data-handle]')
    expect(hs).toHaveLength(3)
    expect(hs[0].getAttribute('width')).toBe('4') // 8 / zoom 2
    expect(hs[2].getAttribute('data-mid')).toBe('m1')
  })

  it('busca: só desenha os resultados da folha atual e destaca o selecionado', () => {
    const hits = [{ sheet: 'a', x: 0, y: 0, w: 5, h: 5 }, { sheet: 'b', x: 9, y: 9, w: 5, h: 5 }, { sheet: 'a', x: 20, y: 20, w: 5, h: 5 }]
    const { container } = render(<svg><SearchHighlights hits={hits} page="a" index={2} zoom={1} /></svg>)
    const rs = container.querySelectorAll('rect')
    expect(rs).toHaveLength(2)
    expect(rs[0].getAttribute('fill-opacity')).toBe('0.28')
    expect(rs[1].getAttribute('fill-opacity')).toBe('0.55')
  })

  it('retângulo tracejado: aceita os cantos em qualquer ordem', () => {
    const { container } = render(<svg><DashedRect a={{ x: 40, y: 30 }} b={{ x: 10, y: 5 }} zoom={1} color="red" fillOpacity={0.1} /></svg>)
    const r = container.querySelector('rect')!
    expect([r.getAttribute('x'), r.getAttribute('y'), r.getAttribute('width'), r.getAttribute('height')]).toEqual(['10', '5', '30', '25'])
  })
})

describe('ScaleBanner', () => {
  beforeEach(() => useStore.setState({ scales: {}, toast: null }))

  it('folha sem escala: oferece a escala lida do carimbo e aplica ao clicar', () => {
    render(<ScaleBanner sheetId="s1" detected={50} onHide={() => {}} />)
    expect(screen.getByText(/Folha sem escala/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Usar 1:50 do carimbo/ }))
    expect(useStore.getState().scales.s1.label).toBe('1:50')
    expect(useStore.getState().scales.s1.metersPerUnit).toBeCloseTo(paperScale(50), 12)
  })

  it('folha com escala igual à do carimbo: não mostra nada', () => {
    const { container } = render(<ScaleBanner sheetId="s1" detected={50} current={{ metersPerUnit: paperScale(50), label: '1:50' }} onHide={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('escala diferente do carimbo: avisa e deixa escolher entre usar o carimbo ou manter', () => {
    const onHide = vi.fn()
    render(<ScaleBanner sheetId="s1" detected={50} current={{ metersPerUnit: paperScale(75), label: '1:75' }} onHide={onHide} />)
    expect(screen.getByText(/1:75\) difere da do carimbo \(1:50/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Manter 1:75/ }))
    expect(onHide).toHaveBeenCalled()
    expect(useStore.getState().scales.s1).toBeUndefined() // manter não altera nada
    fireEvent.click(screen.getByRole('button', { name: 'Usar 1:50' }))
    expect(useStore.getState().scales.s1.label).toBe('1:50')
  })
})

describe('Tour (passo a passo)', () => {
  const anchors = () => {
    document.body.insertAdjacentHTML('beforeend', '<div class="scale-banner">aviso</div><nav class="rail"></nav><aside class="panel right"></aside><section class="panel bottom"></section><header class="topbar"><button>3D</button></header>')
  }
  beforeEach(() => {
    localStorage.clear()
    anchors()
    useStore.setState({ sheets: [sheet()], page: 0, scales: {}, tour: 0 })
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
    useStore.setState({ tour: null, sheets: [], scales: {} })
  })

  it('percorre os 5 passos e conclui gravando que já foi visto', () => {
    render(<Tour />)
    const titles: string[] = []
    for (let i = 0; i < 5; i++) {
      titles.push(screen.getByRole('heading').textContent!)
      fireEvent.click(screen.getByRole('button', { name: i === 4 ? 'Concluir' : 'Próximo' }))
    }
    expect(titles.map((t) => t[0])).toEqual(['1', '2', '3', '4', '5'])
    expect(useStore.getState().tour).toBeNull()
    expect(localStorage.getItem('traco.tourDone')).toBe('1')
  })

  it('Voltar retorna ao passo anterior e Pular encerra', () => {
    useStore.setState({ tour: 2 })
    render(<Tour />)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(useStore.getState().tour).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
    expect(useStore.getState().tour).toBeNull()
  })

  it('Esc fecha o passo a passo', () => {
    render(<Tour />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().tour).toBeNull()
  })

  it('passo cujo elemento não existe é pulado', () => {
    document.querySelector('.rail')!.remove()
    render(<Tour />)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' })) // do passo 1 (escala): o 2 (ferramentas) não existe, vai ao 3
    expect(useStore.getState().tour).toBe(2)
  })

  it('não aparece sem passo ativo', () => {
    useStore.setState({ tour: null })
    const { container } = render(<Tour />)
    expect(container.firstChild).toBeNull()
  })
})
