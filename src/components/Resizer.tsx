import { useStore } from '../store'

/** Mostra/oculta painéis (Ctrl+1 lateral, Ctrl+2 quantitativo, Ctrl+3 propriedades). */
export function togglePanel(k: 'left' | 'bottom' | 'right') {
  const s = useStore.getState()
  if (k === 'left') return s.set({ nav: s.nav && !s.focus ? null : 'pages', focus: false, mode: 'review' })
  s.set({ panels: { ...s.panels, [k]: !s.panels[k] || s.focus }, focus: false, mode: 'review' })
}

const LIMITS = { h: [120, 0.7], v: [260, 0.5] } as const

/** Alça para arrastar e mudar a altura do quantitativo (h) ou a largura do painel direito (v). Duplo clique volta ao padrão. */
export function Resizer({ dir }: { dir: 'h' | 'v' }) {
  const key = dir === 'h' ? 'bottomH' : 'rightW'
  const save = (v: number) => {
    try {
      localStorage.setItem(`traco.${key}`, JSON.stringify(v))
    } catch {
      /* sem storage */
    }
  }
  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const start = dir === 'h' ? e.clientY : e.clientX
    const s0 = useStore.getState()[key]
    const [min, maxFrac] = LIMITS[dir]
    const max = (dir === 'h' ? window.innerHeight : window.innerWidth) * maxFrac
    document.body.classList.add('resizing', dir === 'h' ? 'resizing-h' : 'resizing-v')
    let last = s0
    const move = (ev: PointerEvent) => {
      const d = (dir === 'h' ? ev.clientY : ev.clientX) - start
      last = Math.round(Math.max(min, Math.min(max, s0 - d)))
      useStore.setState({ [key]: last } as Partial<ReturnType<typeof useStore.getState>>)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing', 'resizing-h', 'resizing-v')
      save(last)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }
  const reset = () => {
    const v = dir === 'h' ? 240 : 300
    useStore.setState({ [key]: v } as Partial<ReturnType<typeof useStore.getState>>)
    save(v)
  }
  return <div className={`resizer ${dir}`} onPointerDown={down} onDoubleClick={reset} title="Arraste para redimensionar · duplo clique volta ao padrão" />
}
