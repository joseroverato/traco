// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { anyDirty, closeActiveTab, dirtyTabIds, openInTab, switchTab, tabForPath } from './tabs'
import type { Markup, Sheet } from './types'

const sheet = (id: string): Sheet => ({ id, src: 's', srcIndex: 0, baseRot: 0, rot: 0, label: id, width: 100, height: 100 })
const markup = (id: string, page: string): Markup => ({
  id, page, kind: 'area', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], text: '', comment: '', status: 'aberto', author: '', createdAt: 0,
  presetId: null, deduct: false, color: '#f00', width: 1, fill: '#f00', fillOpacity: 0.2, fontSize: 12,
})
const open = (name: string, extra: Record<string, unknown> = {}) => openInTab({ fileName: name, sources: {}, sheets: [sheet(name)], ...extra })

describe('abas de documentos', () => {
  beforeEach(() => {
    while (useStore.getState().tabs.length) closeActiveTab()
    closeActiveTab()
  })

  it('o primeiro documento vira a primeira aba; o segundo abre outra sem mexer no primeiro', () => {
    open('a.pdf')
    useStore.setState({ markups: [markup('m1', 'a.pdf')], dirty: true })
    open('b.pdf')
    const st = useStore.getState()
    expect(st.tabs.map((t) => t.title)).toEqual(['a.pdf', 'b.pdf'])
    expect(st.fileName).toBe('b.pdf')
    expect(st.markups).toHaveLength(0)
    expect(st.dirty).toBe(false)
  })

  it('trocar de aba devolve exatamente o que cada documento tinha (marcações, página, alterações)', () => {
    open('a.pdf')
    const a = useStore.getState().activeTab!
    useStore.setState({ markups: [markup('m1', 'a.pdf')], dirty: true, scales: { 'a.pdf': { metersPerUnit: 0.01, label: '1:50' } } })
    open('b.pdf')
    const b = useStore.getState().activeTab!
    switchTab(a)
    let st = useStore.getState()
    expect(st.fileName).toBe('a.pdf')
    expect(st.markups.map((m) => m.id)).toEqual(['m1'])
    expect(st.dirty).toBe(true)
    expect(st.scales['a.pdf'].label).toBe('1:50')
    switchTab(b)
    st = useStore.getState()
    expect(st.fileName).toBe('b.pdf')
    expect(st.markups).toHaveLength(0)
    expect(st.dirty).toBe(false)
  })

  it('a ferramenta e o estado transitório não passam de um documento para outro', () => {
    open('a.pdf')
    useStore.setState({ tool: 'area', calibrating: { page: 'a.pdf', length: 3 }, editingText: 'x' })
    open('b.pdf')
    const st = useStore.getState()
    expect(st.tool).toBe('select')
    expect(st.calibrating).toBeNull()
    expect(st.editingText).toBeNull()
  })

  it('sabe quais abas têm alterações pendentes (o app de PC pergunta antes de fechar)', () => {
    open('a.pdf')
    useStore.setState({ dirty: true })
    open('b.pdf')
    expect(anyDirty()).toBe(true)
    expect(dirtyTabIds()).toHaveLength(1)
    closeActiveTab() // fecha b
    expect(useStore.getState().dirty).toBe(true) // voltou para a, que estava alterada
  })

  it('fechar a aba mostra a vizinha; fechar a última deixa o app vazio', () => {
    open('a.pdf')
    open('b.pdf')
    open('c.pdf')
    switchTab(useStore.getState().tabs[1].id)
    closeActiveTab()
    expect(useStore.getState().fileName).toBe('c.pdf')
    expect(useStore.getState().tabs).toHaveLength(2)
    closeActiveTab()
    closeActiveTab()
    const st = useStore.getState()
    expect(st.tabs).toHaveLength(0)
    expect(st.activeTab).toBeNull()
    expect(st.sheets).toHaveLength(0)
    expect(st.fileName).toBe('')
  })

  it('o mesmo projeto .traco aberto duas vezes só volta para a aba que já existe', () => {
    open('p.traco', { projectPath: 'C:\\obras\\p.traco' })
    const first = useStore.getState().activeTab!
    open('outro.pdf')
    expect(tabForPath('C:\\obras\\p.traco')).toBe(first)
    expect(open('p.traco', { projectPath: 'C:\\obras\\p.traco' })).toBe(false)
    expect(useStore.getState().tabs).toHaveLength(2)
    expect(useStore.getState().activeTab).toBe(first)
  })
})

describe('marcador ativo ao trocar de ferramenta', () => {
  it('escolher outra ferramenta solta o marcador (a lista não o mostra mais marcado)', () => {
    const st = useStore.getState()
    const area = st.presets.find((p) => p.measure === 'area')!
    useStore.setState({ activePreset: area.id, tool: 'area' })
    useStore.getState().setTool('select')
    expect(useStore.getState().activePreset).toBeNull()
  })
  it('escolher a ferramenta do próprio marcador mantém o marcador', () => {
    const area = useStore.getState().presets.find((p) => p.measure === 'area')!
    useStore.setState({ activePreset: area.id, tool: 'select' })
    useStore.getState().setTool('area')
    expect(useStore.getState().activePreset).toBe(area.id)
  })
})
