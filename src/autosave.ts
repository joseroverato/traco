/**
 * Salvamento automático e recuperação.
 * App de PC: grava em %APPDATA%\Traco\recovery.traco. Navegador: IndexedDB.
 */
import { useStore } from './store'
import { desktop } from './platform'
import { kvDel, kvGet, kvSet } from './sinapi'

const KEY = 'recovery'
const DELAY = 20_000
let timer: ReturnType<typeof setTimeout> | null = null
let started = false

export interface RecoveryInfo { savedAt: number; fileName: string; sheets: number; markups: number }

async function write() {
  timer = null
  const { serializeProject } = await import('./project')
  const json = serializeProject()
  if (!json) return
  const st = useStore.getState()
  const info: RecoveryInfo = { savedAt: Date.now(), fileName: st.fileName, sheets: st.sheets.length, markups: st.markups.length }
  try {
    if (desktop?.recovery) await desktop.recovery.write(json, JSON.stringify(info))
    else {
      await kvSet(KEY, json)
      await kvSet(KEY + ':info', info)
    }
  } catch (e) {
    console.warn('autosave', e)
  }
}

export async function readRecoveryInfo(): Promise<RecoveryInfo | null> {
  try {
    if (desktop?.recovery) {
      const s = await desktop.recovery.info()
      return s ? (JSON.parse(s) as RecoveryInfo) : null
    }
    return ((await kvGet(KEY + ':info')) as RecoveryInfo | undefined) ?? null
  } catch {
    return null
  }
}

export async function restoreRecovery() {
  const json = desktop?.recovery ? await desktop.recovery.read() : ((await kvGet(KEY)) as string | undefined)
  if (!json) throw new Error('Nada para recuperar')
  const { loadProject } = await import('./project')
  await loadProject(new TextEncoder().encode(json).buffer as ArrayBuffer)
  useStore.setState({ dirty: true })
}

export async function clearRecovery() {
  if (timer) clearTimeout(timer)
  timer = null
  try {
    if (desktop?.recovery) await desktop.recovery.clear()
    else {
      await kvDel(KEY)
      await kvDel(KEY + ':info')
    }
  } catch {
    /* ignore */
  }
}

/** Acompanha as mudanças do projeto e agenda o salvamento automático. */
export function startAutosave() {
  if (started) return
  started = true
  useStore.subscribe((s, prev) => {
    if (!s.sheets.length) return
    const changed = s.markups !== prev.markups || s.sheets !== prev.sheets || s.scales !== prev.scales || s.overlays !== prev.overlays || s.columns !== prev.columns || s.bdi !== prev.bdi || s.hiddenLayers !== prev.hiddenLayers
    // abrir um arquivo novo troca as fontes: não é alteração do usuário
    if (!changed || s.sources !== prev.sources && s.markups.length === 0) return
    if (!s.dirty) useStore.setState({ dirty: true })
    desktop?.setDirty?.(true)
    if (!timer) timer = setTimeout(write, DELAY)
  })
  useStore.subscribe((s, prev) => {
    if (s.dirty !== prev.dirty) desktop?.setDirty?.(s.dirty)
  })
  window.addEventListener('beforeunload', (e) => {
    if (!desktop && useStore.getState().dirty) {
      void write()
      e.preventDefault()
    }
  })
}
