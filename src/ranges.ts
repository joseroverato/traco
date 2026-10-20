import { t } from './i18n'
/** "1-3, 5, 8-10" → grupos de índices (base 1). */
export function parseRanges(txt: string, max: number): number[][] {
  return txt
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part)
      if (!m) throw new Error(t('ranges.intervalo_invalido', { part }))
      const a = Number(m[1]), b = Number(m[2] ?? m[1])
      if (a < 1 || b > max || a > b) throw new Error(t('ranges.fora_do_intervalo', { part }))
      return Array.from({ length: b - a + 1 }, (_, i) => a + i)
    })
}
