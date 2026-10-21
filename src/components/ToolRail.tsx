import { useStore } from '../store'
import { TOOLS } from '../railTools'
import { RichTip } from './RichTip'
import { useKeymap } from '../hotkeys'

export function ToolRail() {
  const { tool, setTool, sheets } = useStore()
  const doc = sheets.length > 0
  useKeymap() // redesenha quando a pessoa troca uma letra
  let last = -1
  return (
    <nav className="rail">
      {TOOLS.map((t) => {
        const sep = last !== -1 && t.group !== last
        last = t.group
        const I = t.icon
        return (
          <div key={t.id} className="rail-item">
            {sep && <div className="rail-sep" />}
            <RichTip tool={t.id} shortcut={t.key}>
              <button
                className={`rail-btn ${tool === t.id ? 'active' : ''}`}
                disabled={!doc && t.id !== 'select'}
                onClick={() => setTool(t.id)}
                aria-label={t.label}
              >
                <I size={18} strokeWidth={1.7} />
              </button>
            </RichTip>
          </div>
        )
      })}
    </nav>
  )
}
