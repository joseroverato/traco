import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { clearSheetSel, clickSheet, duplicateSel, moveSheets, pagesSelected, removeSel, reverseOrder, selectAllSheets, setPagesSel, usePagesUi } from './pagesUi'
import { ZOOM_MAX, ZOOM_MIN, compareSelection, compareZoomBy, regionsLabel, resetCompareUi, useCompareUi } from './compareShare'
import { mk, sheet } from './testUtils'

const three = () => [sheet({ id: 'a', label: 'A' }), sheet({ id: 'b', label: 'B' }), sheet({ id: 'c', label: 'C' })]
const labels = () => useStore.getState().sheets.map((x) => x.label).join('')
const noKeys = { shiftKey: false, ctrlKey: false, metaKey: false }

describe('modo Pranchas (pagesUi): as mesmas funções da grade e da faixa', () => {
  beforeEach(() => {
    useStore.setState({ sheets: three(), markups: [], scales: {}, past: [], future: [], selected: [] })
    usePagesUi.setState({ sel: [], anchor: null, dlg: null, busy: null })
  })

  it('Todas e Limpar mexem só na seleção; ids de folhas que já não existem são ignorados', () => {
    selectAllSheets()
    expect(pagesSelected()).toEqual(['a', 'b', 'c'])
    clearSheetSel()
    expect(pagesSelected()).toEqual([])
    setPagesSel(['b', 'fantasma'])
    expect(pagesSelected()).toEqual(['b'])
  })

  it('clique simples troca, Ctrl soma e tira, Shift marca o intervalo', () => {
    clickSheet(noKeys, 'a')
    clickSheet({ ...noKeys, ctrlKey: true }, 'c')
    expect(pagesSelected()).toEqual(['a', 'c'])
    clickSheet({ ...noKeys, ctrlKey: true }, 'a')
    expect(pagesSelected()).toEqual(['c'])
    clickSheet(noKeys, 'a')
    clickSheet({ ...noKeys, shiftKey: true }, 'c')
    expect(pagesSelected()).toEqual(['a', 'b', 'c'])
  })

  it('Duplicar copia a folha logo depois e leva escala e marcações', () => {
    useStore.setState({ scales: { b: { metersPerUnit: 0.01, label: '1:50' } }, markups: [mk({ page: 'b' })] })
    setPagesSel(['b'])
    duplicateSel()
    const st = useStore.getState()
    expect(st.sheets.map((x) => x.label)).toEqual(['A', 'B', 'B (cópia)', 'C'])
    const copy = st.sheets[2]
    expect(st.scales[copy.id]?.label).toBe('1:50')
    expect(st.markups.filter((m) => m.page === copy.id)).toHaveLength(1)
  })

  it('Excluir tira as folhas marcadas, mas nunca todas', () => {
    setPagesSel(['a', 'b'])
    removeSel()
    expect(labels()).toBe('C')
    selectAllSheets()
    removeSel()
    expect(labels()).toBe('C')
    expect(useStore.getState().toastKind).toBe('err')
  })

  it('arrastar leva o grupo para a posição pedida; Inverter ordem vira a lista', () => {
    moveSheets(['a'], 3)
    expect(labels()).toBe('BCA')
    moveSheets(['c', 'a'], 0)
    expect(labels()).toBe('CAB')
    reverseOrder()
    expect(labels()).toBe('BAC')
  })
})

describe('comparação (compareShare): revisões A e B, zoom e texto do resultado', () => {
  beforeEach(resetCompareUi)

  it('sem escolha, A é a 1ª folha e B a 2ª (com uma só, as duas são ela)', () => {
    const two = [sheet({ id: 'a' }), sheet({ id: 'b' })]
    const cs = compareSelection(two, useCompareUi.getState())
    expect([cs.aId, cs.bId]).toEqual(['a', 'b'])
    expect(compareSelection([two[0]], useCompareUi.getState()).bId).toBe('a')
  })

  it('folhas de outro PDF entram nas opções, marcadas como externas, e valem como A ou B', () => {
    const local = [sheet({ id: 'a' }), sheet({ id: 'b' })]
    useCompareUi.setState({ extra: [sheet({ id: 'x' })], aId: 'x', bId: 'b' })
    const cs = compareSelection(local, useCompareUi.getState())
    expect(cs.options.map((o) => [o.sh.id, o.ext])).toEqual([['a', false], ['b', false], ['x', true]])
    expect(cs.a?.ext).toBe(true)
    expect(cs.b?.ext).toBe(false)
  })

  it('o zoom da comparação respeita os limites', () => {
    for (let i = 0; i < 40; i++) compareZoomBy(1.25)
    expect(useCompareUi.getState().zoom).toBe(ZOOM_MAX)
    for (let i = 0; i < 80; i++) compareZoomBy(1 / 1.25)
    expect(useCompareUi.getState().zoom).toBe(ZOOM_MIN)
  })

  it('o contador de regiões tem plural real e fala "nenhuma" no zero', () => {
    expect(regionsLabel(0)).toBe('Nenhuma região alterada')
    expect(regionsLabel(1)).toBe('1 região alterada')
    expect(regionsLabel(3)).toBe('3 regiões alteradas')
  })
})
