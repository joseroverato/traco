import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { LANGS, detectLang, setLang, t } from './index'
import type { Catalog, Lang } from './index'
import { pt } from './pt'
import { stampText } from '../geometry'

const OTHERS = LANGS.map((l) => l.id).filter((l): l is Exclude<Lang, 'pt'> => l !== 'pt')
const catalogs: Record<string, Catalog> = { pt }

/** Chaves cujo texto traz variáveis de carimbo ({data}, {folha}…) que mudam de nome por idioma. */
const TOKEN_KEYS = new Set(['dialogs.aprovado_para_obra', 'vieweractions.revisado', 'rightpanel.texto_variaveis', 'viewerhints.carimbo_clique_para_posicionar_variaveis', 'toolinfo.clique_para_colocar_um_carimbo', 'dialogs.stamp_tokens', 'pagesview.padrao_numero_n_2_com', 'dialogs.folha_de', 'pagesview.padrao_inicial'])
const placeholders = (s: string) => [...s.matchAll(/\{(\w+(?::\d)?)\}/g)].map((m) => m[1]).sort()
const tags = (s: string) => [...s.matchAll(/<\/?(?:b|i|em|kbd|code)>/g)].map((m) => m[0]).sort()

beforeAll(async () => {
  const load = { en: () => import('./en'), es: () => import('./es'), fr: () => import('./fr'), de: () => import('./de'), it: () => import('./it'), zh: () => import('./zh') }
  for (const l of OTHERS) catalogs[l] = (await load[l]()).default
})

describe('catálogos de idioma', () => {
  it('todos os idiomas têm exatamente as chaves do português', () => {
    const keys = Object.keys(pt).sort()
    for (const l of OTHERS) expect(Object.keys(catalogs[l]).sort(), l).toEqual(keys)
  })

  it('nenhuma tradução está vazia (exceto as que o português também deixa vazias)', () => {
    for (const l of OTHERS) for (const [k, v] of Object.entries(catalogs[l])) if ((pt as Record<string, string>)[k] !== '') expect(v.trim().length, `${l}:${k}`).toBeGreaterThan(0)
  })

  it('as variáveis {x} de cada texto são as mesmas do português (senão a troca falha em silêncio)', () => {
    for (const l of OTHERS) for (const k of Object.keys(pt)) {
      if (TOKEN_KEYS.has(k)) continue
      expect(placeholders(catalogs[l][k as keyof Catalog]), `${l}:${k}`).toEqual(placeholders(pt[k as keyof typeof pt]))
    }
  })

  it('os destaques <b>, <kbd>… se mantêm abertos e fechados em todas as línguas', () => {
    for (const l of OTHERS) for (const k of Object.keys(pt)) expect(tags(catalogs[l][k as keyof Catalog]), `${l}:${k}`).toEqual(tags(pt[k as keyof typeof pt]))
  })

  it('as variáveis de carimbo de cada idioma funcionam de verdade no carimbo', () => {
    const ctx = { n: 2, total: 9, label: 'A-02', file: 'obra.pdf', author: 'Ana' }
    for (const l of [...OTHERS, 'pt'] as Lang[]) {
      const tokens = catalogs[l]['dialogs.stamp_tokens'].split(' ')
      expect(tokens, l).toHaveLength(7)
      const out = stampText(tokens.join(' '), ctx)
      expect(out, `${l}: ${out}`).not.toMatch(/[{}]/)
    }
  })
})

describe('t()', () => {
  it('troca {variáveis} e deixa em branco as indefinidas', async () => {
    await setLang('pt', false)
    expect(t('scalebanner.manter_1', { n: 75 })).toBe('Manter 1:75')
    expect(t('dialogs.recuperar_texto', { nome: undefined, data: 'x', folhas: 1, marcacoes: 2 })).toContain('<b></b>')
  })

  it('troca de idioma muda o texto', async () => {
    await setLang('en', false)
    expect(t('topbar.revisar')).toBe('Review')
    await setLang('de', false)
    expect(t('railtools.tarja_corrigir_texto')).toBe('Schwärzen / Text korrigieren')
    await setLang('pt', false)
  })
})

describe('detectLang', () => {
  it('usa o idioma salvo; senão o do sistema; senão inglês', () => {
    expect(detectLang('fr', 'pt-BR')).toBe('fr')
    expect(detectLang(null, 'pt-BR')).toBe('pt')
    expect(detectLang(null, 'es-MX')).toBe('es')
    expect(detectLang(null, 'zh-TW')).toBe('zh')
    expect(detectLang(null, 'ja-JP')).toBe('en')
    expect(detectLang('xx', 'de-AT')).toBe('de')
  })
})

describe('uso no código', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const files: string[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p)
    }
  }
  walk(root)

  const varNames = (obj: ts.Node): string[] =>
    ts.isObjectLiteralExpression(obj) ? obj.properties.map((p) => (ts.isShorthandPropertyAssignment(p) ? p.name.text : ts.isPropertyAssignment(p) ? p.name.getText() : '')) : []

  it('toda chamada t()/tPdf()/<Rich> usa uma chave que existe e passa as variáveis certas', () => {
    const problems: string[] = []
    for (const f of files) {
      const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const rel = path.relative(root, f)
      const check = (key: string, vars: string[], node: ts.Node) => {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
        const text = (pt as Record<string, string>)[key]
        if (text === undefined) return void problems.push(`${rel}:${line} chave inexistente "${key}"`)
        if (TOKEN_KEYS.has(key)) return
        const need = placeholders(text), got = [...new Set(vars)].sort()
        if (JSON.stringify(need) !== JSON.stringify(got)) problems.push(`${rel}:${line} "${key}" pede {${need}} e recebeu {${got}}`)
      }
      const visit = (n: ts.Node) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 't' || n.expression.text === 'tPdf') && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
          check(n.arguments[0].text, n.arguments[1] ? varNames(n.arguments[1]) : [], n)
        }
        if (ts.isJsxSelfClosingElement(n) && n.tagName.getText() === 'Rich') {
          const k = n.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'k')
          const v = n.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'vars')
          if (k && k.initializer && ts.isStringLiteral(k.initializer)) {
            const e = v?.initializer && ts.isJsxExpression(v.initializer) ? v.initializer.expression : undefined
            check(k.initializer.text, e ? varNames(e) : [], n)
          }
        }
        ts.forEachChild(n, visit)
      }
      visit(sf)
    }
    expect(problems).toEqual([])
  })

  it('toda chave do catálogo é usada em algum lugar (sem texto morto)', () => {
    const src = files.map((f) => readFileSync(f, 'utf8')).join('\n')
    const unused = Object.keys(pt).filter((k) => !src.includes(`'${k}'`) && !src.includes(`"${k}"`))
    expect(unused).toEqual([])
  })
})

describe('troca de idioma e dados da pessoa', () => {
  it('marcadores padrão acompanham o idioma; os que a pessoa criou ou mexeu não; os ids ficam', async () => {
    const { useStore, defaultPresets, uid } = await import('../store')
    await setLang('pt', false)
    const base = defaultPresets()
    const editado = { ...base[1], name: 'Contrapiso do 2º andar' } // a pessoa renomeou
    const meu = { ...base[0], id: uid(), name: 'Meu serviço', group: 'Meu grupo' }
    useStore.setState({ presets: [base[0], editado, meu] })
    const ids = useStore.getState().presets.map((p) => p.id)
    await setLang('en', false)
    const [a, b, c] = useStore.getState().presets
    expect(a.name).toBe('Masonry — ceramic block 14 cm')
    expect(a.group).toBe('Civil')
    expect(a.factorLabel).toBe('ceiling height (m)')
    expect(b.name).toBe('Contrapiso do 2º andar')
    expect(c.name).toBe('Meu serviço')
    expect([a.id, b.id, c.id]).toEqual(ids)
    await setLang('pt', false)
    expect(useStore.getState().presets[0].name).toBe('Alvenaria bloco cerâmico 14 cm')
  })
})
