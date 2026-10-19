/** "1-3, 5, 8-10" → grupos de índices (base 1). */
export function parseRanges(txt: string, max: number): number[][] {
  return txt
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(t)
      if (!m) throw new Error(`intervalo inválido: "${t}"`)
      const a = Number(m[1]), b = Number(m[2] ?? m[1])
      if (a < 1 || b > max || a > b) throw new Error(`fora do intervalo: "${t}"`)
      return Array.from({ length: b - a + 1 }, (_, i) => a + i)
    })
}
