/**
 * Biblioteca de marcadores de quantitativo: ativar, duplicar, excluir, importar, exportar e restaurar o padrão.
 * Vem de fora de componentes para a paleta Marcadores (desktop) e a aba Marcadores do celular usarem os mesmos comandos.
 */
import { defaultPresets, uid, useStore } from './store'
import type { Preset } from './types'
import { t } from './i18n'

/** Marcador "em uso" = ativo E com a ferramenta da sua medida; fora disso o clique o ativa (nunca o desativa). */
export const presetInUse = (activePreset: string | null, tool: string, p: Preset) => activePreset === p.id && tool === p.measure

/** Ativa o marcador e a ferramenta da sua medida; se já está em uso, solta e volta a Selecionar. */
export function activatePreset(p: Preset) {
  const s = useStore.getState()
  if (presetInUse(s.activePreset, s.tool, p)) return s.set({ activePreset: null, tool: 'select' })
  s.set({ activePreset: p.id, tool: p.measure, selected: [] })
}

export const newPreset = () => useStore.getState().set({ presetDialog: { id: null } })
export const editPreset = (id: string) => useStore.getState().set({ presetDialog: { id } })

export function duplicatePreset(p: Preset) {
  const s = useStore.getState()
  const i = s.presets.findIndex((x) => x.id === p.id)
  const c = { ...p, id: uid(), name: t('rightpanel.copia_de', { nome: p.name }) }
  s.setPresets([...s.presets.slice(0, i + 1), c, ...s.presets.slice(i + 1)])
  s.set({ presetDialog: { id: c.id } })
}

/** Exclui sem confirmação; as medições já feitas continuam com a cor do marcador. */
export const deletePreset = (id: string) => {
  const s = useStore.getState()
  s.setPresets(s.presets.filter((x) => x.id !== id))
}

export function exportLibrary() {
  const blob = new Blob([JSON.stringify(useStore.getState().presets, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'biblioteca-marcadores.json'
  a.click()
}

export function importLibrary() {
  const i = document.createElement('input')
  i.type = 'file'
  i.accept = '.json'
  i.onchange = async () => {
    const f = i.files?.[0]
    if (!f) return
    const s = useStore.getState()
    try {
      const arr = JSON.parse(await f.text()) as Preset[]
      s.setPresets([...s.presets, ...arr.map((p) => ({ ...p, id: uid() }))])
      s.notify(t('rightpanel.marcadores_importados', { length: arr.length }))
    } catch {
      s.notify(t('rightpanel.arquivo_de_biblioteca_invalido'), 'err')
    }
  }
  i.click()
}

/** Restaura a biblioteca padrão (substitui tudo, sem confirmação). */
export const resetLibrary = () => useStore.getState().setPresets(defaultPresets())
