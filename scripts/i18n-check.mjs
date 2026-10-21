// Procura textos em português que ficaram fixos no código (fora de t('chave')). Uso: npm run i18n:check
// Heurística: literais e textos JSX com acento ou palavras comuns do português. Não é perfeita, mas pega o esquecido.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const IGNORE_FILES = /(\.test\.|[\\/]i18n[\\/]|tools\.json|about\.ts$|types\.ts$)/
const WORDS = /\b(de|do|da|dos|das|para|com|sem|em|um|uma|n[aã]o|ou|que|os|as|no|na|nos|nas|ao|pelo|pela|seu|sua|este|esta|esse|essa|j[aá]|mais|menos|ainda|todas?|nenhum[a]?|clique|arraste|abrir|salvar|excluir|folha|prancha|escala|marca[çc][aãõo]\w*|erro|novo|nova|ambiente|digite|selecion\w+|aviso|carregando|cancelar|aplicar|fechar)\b/i
const ACCENT = /[À-ÿ]/
const SKIP_PARENT_ATTR = new Set(['className', 'key', 'type', 'id', 'style', 'href', 'target', 'rel', 'viewBox', 'fill', 'stroke', 'd', 'role', 'name', 'value', 'list', 'accept', 'autoComplete', 'ref', 'xmlns', 'src', 'inputMode'])

const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) && files.push(p) } }
walk(root)

let n = 0
for (const file of files) {
  if (IGNORE_FILES.test(file) || /commands\.ts$|presetLookup\.ts$|diagnostics\.ts$|[/\\]ai\.ts$/.test(file)) continue // textos para o Claude e para issues (em inglês de propósito), não para a tela
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const report = (node, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    console.log(`${path.relative(root, file)}:${line + 1}  ${text.replace(/\s+/g, ' ').trim().slice(0, 90)}`)
    n++
  }
  const BRAND = /^(Traço|Claude|Snap|SINAPI|Excel|PDF|OCR|BDI|PC)$/
  const KEYLIKE = /^[a-z]+\.[a-z_0-9]+$/
  const DATA = /^(folha|média|composição|própria|Traço — revisão e quantitativo)$/
  const sus = (s) => !BRAND.test(s.trim()) && !KEYLIKE.test(s) && !DATA.test(s.trim()) && /[A-Za-zÀ-ÿ]{3,}/.test(s) && (ACCENT.test(s) || WORDS.test(s))
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isLiteralTypeNode(node) || ts.isTypeNode(node) && !ts.isLiteralTypeNode(node)) return
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') return
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['log', 'error', 'warn', 'querySelector', 'getElementById', 'addEventListener', 'removeEventListener', 'dispatchEvent', 'getItem', 'setItem', 'includes', 'startsWith', 'endsWith', 'test', 'match', 'replace'].includes(node.expression.name.text)) return
    if (ts.isJsxText(node)) { if (sus(node.text)) report(node, node.text) }
    else if (ts.isTemplateExpression(node)) {
      const text = node.head.text + node.templateSpans.map((sp) => '{x}' + sp.literal.text).join('')
      if (sus(text)) report(node, text)
      node.templateSpans.forEach((sp) => visit(sp.expression))
      return
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent
      if (ts.isJsxAttribute(p) && SKIP_PARENT_ATTR.has(p.name.text)) return
      if (ts.isBinaryExpression(p) && ['===', '!==', '==', '!='].includes(ts.tokenToString(p.operatorToken.kind))) return
      if (ts.isCaseClause(p) || ts.isPropertyAssignment(p) && p.name === node || ts.isElementAccessExpression(p) || ts.isExportDeclaration(p)) return
      if (sus(node.text)) report(node, node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}
console.log(n ? `\n${n} texto(s) possivelmente sem tradução` : 'Nenhum texto em português fixo no código.')
process.exit(n ? 1 : 0)
