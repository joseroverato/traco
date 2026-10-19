import { ClipboardList, Columns2, FileDown, FilePenLine, Files, Layers3, LayoutGrid, Maximize2, Minimize2, Ruler, SquareStack, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import type { State } from '../store'

type Nav = NonNullable<State['nav']>

const PANELS: { id: Nav; icon: typeof Files; label: string }[] = [
  { id: 'pages', icon: Files, label: 'Páginas' },
  { id: 'edit', icon: FilePenLine, label: 'Editar PDF' },
  { id: 'measure', icon: Ruler, label: 'Medir' },
  { id: 'layers', icon: Layers3, label: 'Camadas' },
  { id: 'overlay', icon: SquareStack, label: 'Sobrepor' },
  { id: 'issues', icon: ClipboardList, label: 'Compatib.' },
  { id: 'export', icon: FileDown, label: 'Exportar' },
]

/** Barra de navegação à esquerda, no estilo do Acrobat: abre painéis e troca de modo. */
export function NavBar() {
  const s = useStore()
  const has = s.sheets.length > 0
  const openPanel = (id: Nav) => {
    if (s.mode !== 'review') return s.set({ mode: 'review', nav: id, focus: false })
    s.set({ nav: s.nav === id && !s.focus ? null : id, focus: false })
  }
  return (
    <nav className="navbar">
      {PANELS.map((p) => {
        const I = p.icon
        const active = s.mode === 'review' && s.nav === p.id && !s.focus
        return (
          <button key={p.id} className={`nav-btn ${active ? 'active' : ''}`} disabled={!has && p.id !== 'pages'} onClick={() => openPanel(p.id)}>
            <I size={19} strokeWidth={1.7} />
            <span>{p.label}</span>
          </button>
        )
      })}
      <div className="nav-sep" />
      <button className={`nav-btn ${s.mode === 'pages' ? 'active' : ''}`} disabled={!has} onClick={() => s.set({ mode: s.mode === 'pages' ? 'review' : 'pages', selected: [], tool: 'select' })}>
        <LayoutGrid size={19} strokeWidth={1.7} />
        <span>Organizar</span>
      </button>
      <button className={`nav-btn ${s.mode === 'compare' ? 'active' : ''}`} disabled={!has} onClick={() => s.set({ mode: s.mode === 'compare' ? 'review' : 'compare', selected: [], tool: 'select' })}>
        <Columns2 size={19} strokeWidth={1.7} />
        <span>Comparar</span>
      </button>
      <button className={`nav-btn ${s.mode === 'review' && s.panels.right && s.rightTab === 'claude' && !s.focus ? 'active claude' : 'claude'}`} onClick={() => s.set({ mode: 'review', rightTab: 'claude', panels: { ...s.panels, right: true }, focus: false })}>
        <Sparkles size={19} strokeWidth={1.7} />
        <span>Claude</span>
      </button>
      <div className="grow" />
      <button className={`nav-btn ${s.focus ? 'active' : ''}`} onClick={() => s.set({ focus: !s.focus })} data-tip={s.focus ? 'Mostrar painéis  Tab' : 'Recolher painéis  Tab'}>
        {s.focus ? <Minimize2 size={18} strokeWidth={1.7} /> : <Maximize2 size={18} strokeWidth={1.7} />}
        <span>{s.focus ? 'Painéis' : 'Ampliar'}</span>
      </button>
    </nav>
  )
}
