/**
 * Modelo das paletas da esquerda (R3, fase 2): quais existem, em que ordem e em que estado ficam em cada aba da faixa.
 * Só dados e funções puras (sem store, sem React): o store carrega daqui o estado salvo e os componentes leem por palettes.ts.
 *
 * A aba da faixa decide a pilha padrão (GUIA 4b-e): "open" = aberta, "collapsed" = linha recolhida no pé da coluna.
 * O que a pessoa muda fica gravado POR ABA em localStorage `traco.palettes`; ao trocar de aba, cada paleta volta ao
 * padrão da aba nova, a não ser que esteja fixada (alfinete): a fixada mantém o estado em todas as abas.
 * "closed" = fechada pelo X da barra: some da pilha e a aba lateral (.etb) a reabre.
 */
export type PalId = 'nav' | 'marc' | 'camadas' | 'sobrepor' | 'compat' | 'regioes' | 'legenda' | 'resumo'
export type PalState = 'open' | 'collapsed' | 'closed'
export type StackTab = 'inicio' | 'anotar' | 'pranchas' | 'comparar' | '3d' | 'exibir' | 'claude'

export interface PalPrefs {
  tabs: Partial<Record<StackTab, Partial<Record<PalId, PalState>>>>
  pinned: Partial<Record<PalId, PalState>>
}

const O: PalState = 'open'
const C: PalState = 'collapsed'

/** A tabela do GUIA 4b-(e): ordem de cima para baixo e estado padrão de cada paleta em cada aba. */
export const STACKS: Record<StackTab, [PalId, PalState][]> = {
  inicio: [['nav', O], ['marc', O], ['camadas', C], ['sobrepor', C], ['compat', C]],
  anotar: [['nav', O], ['marc', C], ['camadas', C], ['sobrepor', C], ['compat', O]],
  pranchas: [['nav', O], ['marc', C], ['camadas', C], ['sobrepor', C], ['compat', C]],
  comparar: [['nav', O], ['regioes', O], ['legenda', O], ['marc', C], ['camadas', C], ['sobrepor', C], ['compat', C]],
  '3d': [['nav', O], ['resumo', O], ['marc', C], ['camadas', C], ['sobrepor', C], ['compat', C]],
  exibir: [['nav', O], ['marc', C], ['camadas', O], ['sobrepor', O], ['compat', C]],
  claude: [['nav', O], ['marc', C], ['camadas', C], ['sobrepor', C], ['compat', C]],
}

export const EMPTY_PREFS: PalPrefs = { tabs: {}, pinned: {} }

const defaultOf = (tab: StackTab, id: PalId): PalState => STACKS[tab].find(([p]) => p === id)?.[1] ?? C

/** Estado de uma paleta numa aba: fixada > escolha da pessoa naquela aba > padrão do GUIA. */
export function stateOf(prefs: PalPrefs, tab: StackTab, id: PalId): PalState {
  return prefs.pinned[id] ?? prefs.tabs[tab]?.[id] ?? defaultOf(tab, id)
}

/** Grava o estado escolhido (na fixação, se a paleta estiver fixada; senão, só naquela aba). Devolve um objeto novo. */
export function withState(prefs: PalPrefs, tab: StackTab, id: PalId, state: PalState): PalPrefs {
  if (prefs.pinned[id] !== undefined) return { ...prefs, pinned: { ...prefs.pinned, [id]: state } }
  return { ...prefs, tabs: { ...prefs.tabs, [tab]: { ...prefs.tabs[tab], [id]: state } } }
}

/** Fixa a paleta no estado que ela tem agora nesta aba (ou solta a fixação). */
export function withPin(prefs: PalPrefs, tab: StackTab, id: PalId, pin: boolean): PalPrefs {
  if (!pin) {
    const rest = { ...prefs.pinned }
    delete rest[id]
    return { ...prefs, pinned: rest }
  }
  return { ...prefs, pinned: { ...prefs.pinned, [id]: stateOf(prefs, tab, id) } }
}

const KEY = 'traco.palettes'
const STATES: PalState[] = ['open', 'collapsed', 'closed']
const valid = (v: unknown): v is PalState => STATES.includes(v as PalState)
const IDS: PalId[] = ['nav', 'marc', 'camadas', 'sobrepor', 'compat', 'regioes', 'legenda', 'resumo']

/** Lê o que ficou salvo, descartando qualquer coisa fora do formato (um arquivo antigo ou editado à mão não derruba o app). */
export function loadPalPrefs(): PalPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PalPrefs> | null
    if (!raw || typeof raw !== 'object') return EMPTY_PREFS
    const clean = (o: unknown) => {
      const out: Partial<Record<PalId, PalState>> = {}
      if (o && typeof o === 'object') for (const id of IDS) if (valid((o as Record<string, unknown>)[id])) out[id] = (o as Record<string, PalState>)[id]
      return out
    }
    const tabs: PalPrefs['tabs'] = {}
    for (const tab of Object.keys(STACKS) as StackTab[]) {
      const one = clean((raw.tabs as Record<string, unknown> | undefined)?.[tab])
      if (Object.keys(one).length) tabs[tab] = one
    }
    return { tabs, pinned: clean(raw.pinned) }
  } catch {
    return EMPTY_PREFS
  }
}

export function savePalPrefs(p: PalPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* sem storage */ }
}
