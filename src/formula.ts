/** Avaliador seguro de fórmulas (sem eval). Ex.: "A + P*H", "max(L, 1) * 1.05", "ceil(N/10)". */
type Vars = Record<string, number>

const FN: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  ceil: Math.ceil, floor: Math.floor, sqrt: Math.sqrt,
}

export function evalFormula(src: string, vars: Vars): number {
  const s = src.replace(/\s+/g, '').replace(/(\d),(\d)/g, '$1.$2')
  let i = 0
  const peek = () => s[i]
  const eat = (c: string) => {
    if (s[i] !== c) throw new Error(`esperado "${c}" na posição ${i + 1}`)
    i++
  }
  const expr = (): number => {
    let v = term()
    while (peek() === '+' || peek() === '-') v = s[i++] === '+' ? v + term() : v - term()
    return v
  }
  const term = (): number => {
    let v = power()
    while (peek() === '*' || peek() === '/') v = s[i++] === '*' ? v * power() : v / power()
    return v
  }
  const power = (): number => {
    const b = unary()
    if (peek() === '^') {
      i++
      return b ** power()
    }
    return b
  }
  const unary = (): number => {
    if (peek() === '-') { i++; return -unary() }
    if (peek() === '+') { i++; return unary() }
    return atom()
  }
  const atom = (): number => {
    if (peek() === '(') { i++; const v = expr(); eat(')'); return v }
    const num = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (num) { i += num[0].length; return parseFloat(num[0]) }
    const id = /^[A-Za-z_]\w*/.exec(s.slice(i))
    if (id) {
      i += id[0].length
      const name = id[0]
      if (peek() === '(') {
        i++
        const args: number[] = []
        if (peek() !== ')') { args.push(expr()); while (peek() === ';' || peek() === ',') { i++; args.push(expr()) } }
        eat(')')
        const f = FN[name.toLowerCase()]
        if (!f) throw new Error(`função desconhecida: ${name}`)
        return f(...args)
      }
      const key = name.toUpperCase()
      if (!(key in vars)) throw new Error(`variável desconhecida: ${name}`)
      return vars[key]
    }
    throw new Error(`símbolo inesperado na posição ${i + 1}`)
  }
  if (!s) throw new Error('fórmula vazia')
  const v = expr()
  if (i < s.length) throw new Error(`símbolo inesperado na posição ${i + 1}`)
  if (!Number.isFinite(v)) throw new Error('resultado inválido')
  return v
}

export function checkFormula(src: string): string | null {
  try {
    evalFormula(src, { L: 1, A: 1, P: 1, N: 1, H: 1, V: 1, PV: 1, Q: 1 })
    return null
  } catch (e) {
    return (e as Error).message
  }
}
