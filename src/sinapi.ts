/**
 * Base de preços (SINAPI ou composições próprias) guardada no próprio computador (IndexedDB).
 * Importa as planilhas da Caixa (.xlsx/.csv) detectando as colunas automaticamente.
 */
import type { SinapiItem } from './types'
import { t } from './i18n'

const DB = 'traco'
const STORE = 'kv'

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await idb()
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(key)
    q.onsuccess = () => res(q.result as T)
    q.onerror = () => rej(q.error)
  })
}
export async function kvSet(key: string, val: unknown) {
  const db = await idb()
  return new Promise<void>((res, rej) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).put(val, key)
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
  })
}
export async function kvDel(key: string) {
  const db = await idb()
  return new Promise<void>((res) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).delete(key)
    t.oncomplete = () => res()
  })
}

export interface PriceBase {
  label: string // ex.: "SINAPI PR 09/2026 não desonerado"
  importedAt: number
  items: SinapiItem[]
}

let cache: PriceBase | null | undefined
export async function loadBase(): Promise<PriceBase | null> {
  if (cache !== undefined) return cache
  try {
    cache = (await kvGet<PriceBase>('price-base')) ?? null
  } catch {
    cache = null
  }
  return cache
}
export async function clearBase() {
  cache = null
  await kvDel('price-base')
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** "1.234,56" / "1234.56" / 1234.56 → número */
export function brNumber(v: unknown): number {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim().replace(/[R$\s]/g, '')
  if (!s) return NaN
  if (/,\d{1,4}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  return Number(s.replace(/,/g, ''))
}

export function unitToTraco(u: string): string {
  const k = norm(u).replace(/\s/g, '')
  return ({ m2: 'm²', 'm²': 'm²', m3: 'm³', 'm³': 'm³', m: 'm', un: 'un', und: 'un', unid: 'un', pc: 'un', kg: 'kg', h: 'h', l: 'L', t: 't', cj: 'cj', vb: 'vb' } as Record<string, string>)[k] ?? u
}
export const measureForUnit = (u: string): 'length' | 'area' | 'count' => (u === 'm²' ? 'area' : u === 'm' ? 'length' : 'count')

/** Lê planilhas da Caixa (composições/insumos) ou uma planilha própria com Código/Descrição/Unidade/Preço. */
export async function importPriceFile(file: File, label: string, merge: boolean): Promise<PriceBase> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const items = new Map<string, SinapiItem>()
  if (merge) (await loadBase())?.items.forEach((i) => items.set(i.code, i))
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })
    // acha a linha de cabeçalho nas primeiras 40 linhas
    let h = -1
    let col = { code: -1, desc: -1, unit: -1, price: -1 }
    for (let r = 0; r < Math.min(40, rows.length) && h < 0; r++) {
      const cells = (rows[r] ?? []).map((c) => norm(String(c)))
      const find = (re: RegExp, not?: RegExp) => cells.findIndex((c) => re.test(c) && !(not && not.test(c)))
      const code = find(/^cod|codigo/)
      const desc = find(/descri/)
      const unit = find(/^unid|unidade/)
      let price = find(/custo total|preco mediano|preco unit|custo unit|valor unit/)
      if (price < 0) price = find(/custo|preco|valor/, /origem|%/)
      if (code >= 0 && desc >= 0 && unit >= 0 && price >= 0) {
        h = r
        col = { code, desc, unit, price }
      }
    }
    if (h < 0) continue
    const kind: SinapiItem['kind'] = /insumo/i.test(name + String(rows[h]?.[col.desc] ?? '')) ? 'insumo' : /sinapi|composi/i.test(name + file.name) ? 'composição' : 'própria'
    for (const row of rows.slice(h + 1)) {
      const code = String(row[col.code] ?? '').trim()
      const desc = String(row[col.desc] ?? '').trim()
      const price = brNumber(row[col.price])
      if (!code || !desc || !Number.isFinite(price)) continue
      items.set(code, { code, desc, unit: unitToTraco(String(row[col.unit] ?? '').trim()), price, kind })
    }
  }
  if (!items.size) throw new Error(t('sinapi.nao_encontrei_as_colunas_codigo'))
  const base: PriceBase = { label, importedAt: Date.now(), items: [...items.values()] }
  await kvSet('price-base', base)
  cache = base
  return base
}

/** Busca por código (início) ou por todas as palavras da descrição. */
export function searchBase(base: PriceBase | null, q: string, limit = 30): SinapiItem[] {
  if (!base || !q.trim()) return []
  const t = norm(q.trim())
  const words = t.split(/\s+/)
  const out: SinapiItem[] = []
  for (const it of base.items) {
    if (it.code.startsWith(t) || words.every((w) => norm(it.desc).includes(w))) {
      out.push(it)
      if (out.length >= limit) break
    }
  }
  return out
}

export const findByCode = (base: PriceBase | null, code: string) => base?.items.find((i) => i.code === code)
