import { createElement } from 'react'
import type { ReactNode } from 'react'
import { desktop } from '../platform'

/**
 * Notas da versão. O atualizador do app de PC entrega o texto da release do GitHub já como HTML ("<h2>…</h2><ul><li>…").
 * Em vez de mostrar as marcas na tela, o HTML é lido e remontado só com as marcas permitidas (títulos, listas, negrito, código, links http/https);
 * tudo o mais (scripts, estilos, imagens, atributos) é descartado. Texto em Markdown (sem marcas HTML) também é aceito.
 */
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const KEEP = new Set(['p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 'strong', 'hr', 'br'])
const RENAME: Record<string, string> = { b: 'strong', i: 'em' }
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'img', 'video', 'audio', 'link', 'meta', 'noscript', 'template'])

const openLink = (e: React.MouseEvent, url: string) => {
  if (!desktop?.openExternal) return // na web o link abre normalmente em outra aba
  e.preventDefault()
  void desktop.openExternal(url)
}

function fromNode(n: Node, key: number): ReactNode {
  if (n.nodeType === 3) {
    const txt = n.textContent ?? ''
    // espaços entre as marcas de uma lista não viram texto solto
    if (!txt.trim() && /^(ul|ol)$/i.test((n.parentElement?.tagName ?? ''))) return null
    return txt
  }
  if (n.nodeType !== 1) return null
  const el = n as Element
  const tag = el.tagName.toLowerCase()
  if (DROP.has(tag)) return null
  const kids = Array.from(el.childNodes).map(fromNode)
  if (HEADINGS.has(tag)) return createElement('h5', { key, className: 'notes-h' }, ...kids)
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? ''
    if (!/^https?:\/\//i.test(href)) return createElement('span', { key }, ...kids)
    return createElement('a', { key, href, target: '_blank', rel: 'noreferrer', onClick: (e: React.MouseEvent) => openLink(e, href) }, ...kids)
  }
  const out = RENAME[tag] ?? tag
  if (KEEP.has(out)) return tag === 'br' || tag === 'hr' ? createElement(out, { key }) : createElement(out, { key }, ...kids)
  return createElement('span', { key }, ...kids) // marca desconhecida: fica só o conteúdo
}

/** Markdown simples: títulos (#), listas (- ou *), **negrito** e `código`. */
function inline(s: string, k: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index))
    parts.push(m[1] ? createElement('strong', { key: `${k}${i++}` }, m[1]) : createElement('code', { key: `${k}${i++}` }, m[2]))
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push(s.slice(last))
  return parts
}

function fromMarkdown(src: string): ReactNode[] {
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  const flush = () => {
    if (list.length) out.push(createElement('ul', { key: `u${out.length}` }, ...list))
    list = []
  }
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd()
    const h = /^#{1,6}\s+(.*)$/.exec(line)
    const li = /^\s*[-*]\s+(.*)$/.exec(line)
    if (h) {
      flush()
      out.push(createElement('h5', { key: `h${i}`, className: 'notes-h' }, ...inline(h[1], `h${i}`)))
    } else if (li) list.push(createElement('li', { key: `l${i}` }, ...inline(li[1], `l${i}`)))
    else if (line.trim()) {
      flush()
      out.push(createElement('p', { key: `p${i}` }, ...inline(line, `p${i}`)))
    } else flush()
  })
  flush()
  return out
}

function renderNotes(source: string): ReactNode[] {
  if (/<\/?[a-z][a-z0-9]*[\s>/]/i.test(source)) {
    const doc = new DOMParser().parseFromString(source, 'text/html') // não executa scripts
    return Array.from(doc.body.childNodes).map(fromNode)
  }
  return fromMarkdown(source)
}

export function ReleaseNotes({ source }: { source: string }) {
  return <div className="notes">{renderNotes(source)}</div>
}
