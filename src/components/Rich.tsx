import { Fragment } from 'react'
import { t } from '../i18n'
import type { Key } from '../i18n'

/**
 * Texto traduzido com destaques simples: <b>, <i>, <em>, <kbd>, <code> dentro da própria tradução.
 * Cada idioma põe as marcas onde a frase delas precisa, sem depender da ordem das palavras do português.
 * Os valores de {vars} entram só como texto (nunca como HTML).
 */
export function Rich({ k, vars }: { k: Key; vars?: Record<string, string | number | undefined> }) {
  return <>{renderRich(t(k), vars)}</>
}

const TAG = /<(b|i|em|kbd|code)>(.*?)<\/\1>/g

function renderRich(src: string, vars?: Record<string, string | number | undefined>) {
  const fill = (s: string) => (vars ? s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name] ?? '') : m)) : s)
  // t() já substituiu {vars} no texto inteiro; aqui o texto vem cru, então a troca é feita por trecho (valores nunca viram tags)
  const out: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of src.matchAll(TAG)) {
    if (m.index > last) out.push(<Fragment key={i++}>{fill(src.slice(last, m.index))}</Fragment>)
    const Tag = m[1] as 'b' | 'i' | 'em' | 'kbd' | 'code'
    out.push(<Tag key={i++}>{fill(m[2])}</Tag>)
    last = m.index + m[0].length
  }
  if (last < src.length) out.push(<Fragment key={i++}>{fill(src.slice(last))}</Fragment>)
  return out
}
