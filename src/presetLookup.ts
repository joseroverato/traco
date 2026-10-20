import type { Preset } from './types'

/**
 * Acha um marcador por id, nome exato ou parte do nome (nesta ordem).
 * Parte do nome só vale se der um único resultado: com mais de um, avisa em vez de escolher um qualquer.
 */
export function findPreset(presets: Preset[], ref: unknown): Preset | undefined {
  if (!ref) return undefined
  const str = String(ref).trim().toLowerCase()
  const exact = presets.find((p) => p.id === ref) ?? presets.find((p) => p.name.toLowerCase() === str)
  if (exact) return exact
  const parts = presets.filter((p) => p.name.toLowerCase().includes(str))
  if (parts.length > 1) throw new Error(`"${ref}" combina com ${parts.length} marcadores (${parts.slice(0, 5).map((p) => p.name).join('; ')}). Use o nome completo ou o id (list_presets).`)
  return parts[0]
}
