/**
 * Idiomas do Traço. O português (pt.ts) é a fonte: toda chave nasce lá, e cada outro idioma é obrigado pelo TypeScript
 * a ter todas as chaves. As traduções não são literais: nomes de ferramentas e termos de obra seguem o uso da área em cada idioma.
 *
 * - `t('chave', { n: 3 })` devolve o texto com {n} substituído (uso fora de componentes: avisos, exportações).
 * - `useT()` faz o componente redesenhar quando o idioma muda.
 * - Plural: chaves `x_one` / `x_other`, usadas com `tp('x', n)`.
 */
import { useSyncExternalStore } from 'react'
import { pt } from './pt'

export type Key = keyof typeof pt
export type Catalog = Record<Key, string>
export type Lang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'zh'
type PluralBase = Key extends infer K ? (K extends `${infer B}_one` ? B : never) : never

/** Nome de cada idioma na própria língua (é como a pessoa o procura na lista). */
export const LANGS: { id: Lang; name: string; locale: string }[] = [
  { id: 'pt', name: 'Português', locale: 'pt-BR' },
  { id: 'en', name: 'English', locale: 'en-US' },
  { id: 'es', name: 'Español', locale: 'es-ES' },
  { id: 'fr', name: 'Français', locale: 'fr-FR' },
  { id: 'de', name: 'Deutsch', locale: 'de-DE' },
  { id: 'it', name: 'Italiano', locale: 'it-IT' },
  { id: 'zh', name: '中文（简体）', locale: 'zh-CN' },
]

const KEY = 'traco.lang'
const catalogs: Partial<Record<Lang, Catalog>> = { pt }
const loaders: Record<Exclude<Lang, 'pt'>, () => Promise<{ default: Catalog }>> = {
  en: () => import('./en'),
  es: () => import('./es'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  it: () => import('./it'),
  zh: () => import('./zh'),
}

const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.id === v)

/** Idioma salvo; senão o do sistema (pt, es, fr, de, it, zh); senão inglês. */
export function detectLang(saved?: string | null, nav?: string): Lang {
  if (isLang(saved)) return saved
  const code = (nav ?? (typeof navigator !== 'undefined' ? navigator.language : '') ?? '').toLowerCase().slice(0, 2)
  return isLang(code) ? code : 'en'
}

let current: Lang = 'pt'
const listeners = new Set<() => void>()
const langHandlers: Array<(prev: Lang, next: Lang) => void> = []

/** Avisa quem precisa reagir à troca de idioma (ex.: renomear os marcadores padrão que a pessoa não alterou). */
export const onLangChange = (h: (prev: Lang, next: Lang) => void) => void langHandlers.push(h)

export const getLang = () => current
export const localeOf = (l: Lang = current) => LANGS.find((x) => x.id === l)!.locale

/** Carrega o catálogo (se ainda não estiver) e troca o idioma. `persist` grava a escolha. */
export async function setLang(l: Lang, persist = true) {
  if (!catalogs[l] && l !== 'pt') catalogs[l] = (await loaders[l]()).default
  if (l === 'zh' && !catalogs.en) catalogs.en = (await loaders.en()).default // texto dentro de PDF cai no inglês (veja tPdf)
  const prev = current
  current = l
  if (prev !== l) langHandlers.forEach((h) => h(prev, l))
  if (persist) {
    try { localStorage.setItem(KEY, l) } catch { /* sem storage */ }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = localeOf(l)
  listeners.forEach((f) => f())
}

/** Chamado uma vez antes de desenhar a tela: aplica o idioma salvo ou o do sistema. */
export async function initI18n() {
  let saved: string | null = null
  try { saved = localStorage.getItem(KEY) } catch { /* sem storage */ }
  await setLang(detectLang(saved), false)
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => void listeners.delete(f)
}

const fill = (s: string, vars?: Record<string, string | number | undefined>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m)) : s)

/** Texto no idioma atual; se faltar no idioma, cai no português (nunca mostra a chave). */
export function t(key: Key, vars?: Record<string, string | number | undefined>): string {
  return fill((catalogs[current] ?? pt)[key] ?? pt[key], vars)
}

/** Plural conforme o idioma: usa `base_one` quando n = 1 e `base_other` nos demais; {n} entra no texto. */
export function tp(base: PluralBase, n: number, vars?: Record<string, string | number | undefined>): string {
  const form = new Intl.PluralRules(localeOf()).select(n) === 'one' ? 'one' : 'other'
  return t(`${base}_${form}` as Key, { n, ...vars })
}

/** Hook: devolve `t` e redesenha o componente quando o idioma muda. */
export function useT() {
  useSyncExternalStore(subscribe, getLang)
  return t
}
export const useLang = () => useSyncExternalStore(subscribe, getLang)

/** Número com as casas e separadores do idioma atual (1.234,56 em pt/es/de/it; 1,234.56 em en/zh; fr usa espaço fino). */
export const fmtNum = (n: number, d = 2) => n.toLocaleString(localeOf(), { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * Idioma do texto desenhado DENTRO de PDFs (legendas, relatórios, rótulos de medida). As fontes padrão do PDF (Helvetica, WinAnsi)
 * cobrem português, espanhol, francês, alemão e italiano, mas não ideogramas: em chinês esse texto sai em inglês.
 */
export const pdfLang = (): Lang => (current === 'zh' ? 'en' : current)
export function tPdf(key: Key, vars?: Record<string, string | number | undefined>): string {
  return fill((catalogs[pdfLang()] ?? pt)[key] ?? pt[key], vars)
}
export const fmtDate = (d: Date | number | string, pdf = false) => new Date(d).toLocaleDateString(localeOf(pdf ? pdfLang() : current))
export const fmtDateTime = (d: Date | number | string) => new Date(d).toLocaleString(localeOf())

/** Valor em dinheiro: em português sai com "R$" (a base SINAPI é brasileira); nos outros idiomas, só o número, pois a moeda é a da base de preços da pessoa. */
export const fmtMoney = (n: number) => (current === 'pt' ? 'R$ ' : '') + fmtNum(n, 2)

/** Tradutor de um idioma específico (precisa já estar carregado; senão cai no português). */
export const translator = (l: Lang) => (key: Key, vars?: Record<string, string | number | undefined>) => fill((catalogs[l] ?? pt)[key] ?? pt[key], vars)
