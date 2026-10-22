// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SnapIndex, findSnap } from './snap'
import { useStore } from './store'
import { viewerMenu } from './contextMenu'
import { discardProject, requestCloseProject } from './project'
import { mk, sheet } from './testUtils'
import type { MenuItem } from './components/ContextMenu'

// uma cruz: horizontal de (0,50) a (100,50) e vertical de (50,0) a (50,100); mais uma linha solta que termina perto do cruzamento
const cross = () => {
  const idx = new SnapIndex()
  idx.add(0, 50, 100, 50)
  idx.add(50, 0, 50, 100)
  return idx
}
const ids = (items: MenuItem[]) => items.filter((i): i is Exclude<MenuItem, { sep: true }> => !('sep' in i)).map((i) => i.id)

describe('snap por tipo de ponto (alinhamento de sobreposição)', () => {
  it('só interseções: acha o cruzamento e ignora extremidades', () => {
    const hit = findSnap(cross(), { x: 52, y: 51 }, 6, [], ['intersection'])
    expect(hit?.kind).toBe('intersection')
    expect(hit?.pt).toEqual({ x: 50, y: 50 })
    // perto de uma ponta, mas fora do cruzamento: nada
    expect(findSnap(cross(), { x: 3, y: 51 }, 6, [], ['intersection'])).toBeNull()
  })

  it('só extremidades: não devolve o cruzamento', () => {
    expect(findSnap(cross(), { x: 52, y: 51 }, 6, [], ['endpoint'])).toBeNull()
    expect(findSnap(cross(), { x: 2, y: 49 }, 6, [], ['endpoint'])?.kind).toBe('endpoint')
  })

  it('sem filtro, o comportamento continua o mesmo', () => {
    expect(findSnap(cross(), { x: 52, y: 51 }, 6)?.kind).toBe('intersection')
  })
})

describe('menu do botão direito', () => {
  beforeEach(() => {
    useStore.setState({ sheets: [sheet({ id: 's1' })], page: 0, markups: [], selected: [], tool: 'select', aligning: null, past: [], future: [], snap: true, ortho: false })
  })

  it('traz os itens fixos mesmo sem contexto', () => {
    const got = ids(viewerMenu(null))
    for (const id of ['copytext', 'find', 'scale', 'fitp', 'fitw', 'z100', 'snap', 'ortho', 'undo', 'redo', 'close']) expect(got).toContain(id)
  })

  it('sobre uma marcação selecionada oferece propriedades, duplicar e excluir', () => {
    const m = mk({ id: 'a', page: 's1', kind: 'rect', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })
    useStore.setState({ markups: [m], selected: ['a'] })
    const got = ids(viewerMenu('a'))
    expect(got.slice(0, 3)).toEqual(['props', 'dup', 'del'])
  })

  it('muda com a ferramenta: contagem e alinhamento têm itens próprios', () => {
    useStore.setState({ tool: 'count' })
    expect(ids(viewerMenu(null))).toContain('count')
    useStore.setState({ tool: 'select', aligning: { overlay: 'o', step: 0, pts: [] } })
    const got = ids(viewerMenu(null))
    expect(got).toContain('alignx')
    expect(got).not.toContain('all')
  })

  it('os itens de liga/desliga mostram o estado atual', () => {
    const snap = viewerMenu(null).find((i) => 'id' in i && i.id === 'snap')
    expect(snap && 'checked' in snap && snap.checked).toBe(true)
  })

  it('sem documento, itens que dependem da folha ficam desabilitados', () => {
    useStore.setState({ sheets: [] })
    const scale = viewerMenu(null).find((i) => 'id' in i && i.id === 'scale')
    expect(scale && 'disabled' in scale && scale.disabled).toBe(true)
  })
})

describe('fechar projeto', () => {
  beforeEach(() => {
    useStore.setState({ sheets: [sheet({ id: 's1' })], fileName: 'planta.pdf', dirty: false, dialog: null, markups: [mk({ page: 's1' })], sources: {} })
  })

  it('sem alterações pendentes fecha direto e deixa o app vazio', async () => {
    requestCloseProject()
    await vi.waitFor(() => expect(useStore.getState().sheets).toHaveLength(0))
    const st = useStore.getState()
    expect(st.fileName).toBe('')
    expect(st.markups).toHaveLength(0)
    expect(st.dialog).toBeNull()
  })

  it('com alterações pendentes pergunta antes e não perde nada', () => {
    useStore.setState({ dirty: true })
    requestCloseProject()
    const st = useStore.getState()
    expect(st.dialog).toBe('close')
    expect(st.sheets).toHaveLength(1)
  })

  it('"fechar sem salvar" descarta tudo, inclusive a pergunta aberta', async () => {
    useStore.setState({ dirty: true, dialog: 'close' })
    await discardProject()
    const st = useStore.getState()
    expect(st.sheets).toHaveLength(0)
    expect(st.dirty).toBe(false)
    expect(st.dialog).toBeNull()
  })

  it('sem projeto aberto o pedido não faz nada', () => {
    useStore.setState({ sheets: [], dirty: true })
    requestCloseProject()
    expect(useStore.getState().dialog).toBeNull()
  })
})
