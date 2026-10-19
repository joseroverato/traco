import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { MAX_HISTORY } from './history'
import { sheet } from './testUtils'

const reset = () => useStore.setState({ markups: [], sheets: [sheet()], past: [], future: [], selected: [] })
const add = (n: number) => {
  for (let i = 0; i < n; i++) useStore.getState().addMarkup('rect', 's1', [{ x: i, y: 0 }, { x: i + 1, y: 1 }])
}

describe('histórico de desfazer', () => {
  beforeEach(reset)

  it('limita o histórico em MAX_HISTORY ao criar marcações', () => {
    add(MAX_HISTORY + 30)
    expect(useStore.getState().past).toHaveLength(MAX_HISTORY)
    expect(useStore.getState().markups).toHaveLength(MAX_HISTORY + 30)
  })

  it('limita também updateMarkup, setStatus, removeMarkups, checkpoint e setSheets', () => {
    add(1)
    const st = useStore.getState
    const id = st().markups[0].id
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      st().updateMarkup(id, { text: String(i) })
      st().setStatus([id], 'em análise')
      st().checkpoint()
      st().setSheets([sheet()])
    }
    expect(st().past.length).toBe(MAX_HISTORY)
    st().removeMarkups([id])
    expect(st().past.length).toBe(MAX_HISTORY)
  })

  it('desfazer e refazer continuam funcionando e respeitam o limite', () => {
    add(MAX_HISTORY + 5)
    const st = useStore.getState
    for (let i = 0; i < MAX_HISTORY; i++) st().undo()
    expect(st().past).toHaveLength(0)
    expect(st().markups).toHaveLength(5)
    st().undo() // nada para desfazer: não muda
    expect(st().markups).toHaveLength(5)
    for (let i = 0; i < MAX_HISTORY; i++) st().redo()
    expect(st().markups).toHaveLength(MAX_HISTORY + 5)
    expect(st().past.length).toBeLessThanOrEqual(MAX_HISTORY)
  })

  it('uma ação nova depois de desfazer descarta o "refazer"', () => {
    add(3)
    useStore.getState().undo()
    expect(useStore.getState().future).toHaveLength(1)
    add(1)
    expect(useStore.getState().future).toHaveLength(0)
  })
})
