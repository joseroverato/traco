// Teste de ponta a ponta no app de PC: abre um PDF, define a escala, desenha, confere o quantitativo,
// salva o .traco (ZIP), fecha, reabre e confere que tudo voltou igual.
// Uso: TRACO_EXE=release/win-unpacked/Traço.exe npm run test:e2e   (ou, sem TRACO_EXE, após npm run build:desktop)
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// TRACO_EXE aponta para o app empacotado (release/win-unpacked/Traço.exe); sem ele usa o Electron do projeto.
const exe = process.env.TRACO_EXE
const electronPath = exe ?? createRequire(import.meta.url)('electron')
const pdf = path.join(root, 'e2e', 'fixtures', 'planta-exemplo.pdf')
if (!exe && !existsSync(path.join(root, 'dist-desktop', 'index.html'))) throw new Error('Falta dist-desktop: rode "npm run build:desktop" antes.')

const saveDir = mkdtempSync(path.join(tmpdir(), 'traco-e2e-save-'))
const userData = mkdtempSync(path.join(tmpdir(), 'traco-e2e-data-'))
let falhas = 0
const ok = (cond, msg, extra = '') => { console.log(`${cond ? '  ok  ' : ' FALHA'}  ${msg}${cond ? '' : '  ' + extra}`); if (!cond) falhas++ }
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol

async function abrir() {
  const app = await electron.launch({ executablePath: electronPath, args: [...(exe ? [] : [root]), `--user-data-dir=${userData}`], env: { ...process.env, TRACO_SAVE_DIR: saveDir } })
  const page = await app.firstWindow()
  await page.waitForSelector('input[type=file]', { state: 'attached' })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { app, page, errors }
}
const cmd = (page, name, args = {}) => page.evaluate(async ([n, a]) => {
  const r = await window.__traco.runCommand(n, a)
  const t = r.content.find((c) => c.type === 'text')?.text
  return { error: !!r.isError, text: t, data: t && !r.isError ? JSON.parse(t) : null }
}, [name, args])

// ---------- 1ª sessão: abrir, medir, salvar ----------
console.log('Sessão 1: abrir PDF, escala, marcações, salvar')
let { app, page, errors } = await abrir()
await page.locator('input[type=file][accept=".pdf,.traco"]').setInputFiles(pdf)
await page.waitForFunction(() => window.__traco && document.querySelector('canvas'), null, { timeout: 30000 })
await page.waitForTimeout(1500)

const doc = await cmd(page, 'list_sheets')
ok(!doc.error && doc.data?.length >= 1, 'PDF abriu com ao menos 1 folha', doc.text)

const esc = await cmd(page, 'set_scale', { ratio: 50 })
ok(!esc.error, 'escala 1:50 definida', esc.text)

const K = (0.0254 / 72) * 50 // m por ponto em 1:50
const p = (xm, ym) => [100 + xm / K, 100 + ym / K]
const par = await cmd(page, 'upsert_preset', { name: 'Alvenaria E2E', group: 'Civil', measure: 'length', factor: 2.8, result_unit: 'm²', unit_price: 100 })
const piso = await cmd(page, 'upsert_preset', { name: 'Piso E2E', group: 'Civil', measure: 'area', result_unit: 'm²' })
ok(par.data?.created && piso.data?.created, 'marcadores de teste criados', par.text + piso.text)
const add = await cmd(page, 'add_markups', {
  markups: [
    { kind: 'length', preset: par.data.preset.id, points: [p(0, 0), p(10, 0), p(10, 6), p(0, 6), p(0, 0)] },
    { kind: 'length', preset: par.data.preset.id, deduct: true, points: [p(2, 0), p(2.9, 0)] },
    { kind: 'area', preset: piso.data.preset.id, points: [p(0, 0), p(10, 0), p(10, 6), p(0, 6)], holes: [[p(1, 1), p(2, 1), p(2, 2.5), p(1, 2.5)]] },
  ],
})
ok(!add.error && !JSON.parse(add.text).errors, 'marcações criadas', add.text)

const q1 = await cmd(page, 'get_quantities')
const linha = (q, nome) => (q.data?.rows ?? q.data?.items ?? q.data ?? []).find?.((r) => (r.name ?? r.service ?? r.serviço) === nome)
const qt = (q, nome) => { const r = linha(q, nome); return r ? Number(r.quantity ?? r.qty ?? r.quantidade) : NaN }
console.log('  quantitativo:', JSON.stringify(q1.data).slice(0, 300))
ok(near(qt(q1, 'Alvenaria E2E'), 87.08), 'Alvenaria = 87,08 m² (89,60 − porta 2,52)', String(qt(q1, 'Alvenaria E2E')))
ok(near(qt(q1, 'Piso E2E'), 58.5), 'Piso = 58,50 m² (60 − shaft 1,5)', String(qt(q1, 'Piso E2E')))

const sv = await cmd(page, 'save_project')
ok(!sv.error, 'projeto salvo', sv.text)
const arquivos = readdirSync(saveDir).filter((f) => f.endsWith('.traco'))
ok(arquivos.length === 1, `.traco criado em disco (${arquivos.join(', ')})`)
const bytes = arquivos.length ? readFileSync(path.join(saveDir, arquivos[0])) : Buffer.alloc(0)
ok(bytes.subarray(0, 2).toString() === 'PK', 'formato é ZIP (v3)', bytes.subarray(0, 4).toString('hex'))
ok(errors.length === 0, 'sem erros de JavaScript na sessão 1', errors.join(' | '))
await app.close()

// ---------- 2ª sessão: reabrir ----------
console.log('Sessão 2: reabrir o .traco')
;({ app, page, errors } = await abrir())
await page.locator('input[type=file][accept=".pdf,.traco"]').setInputFiles(path.join(saveDir, arquivos[0]))
await page.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 30000 })
await page.waitForTimeout(1500)
const q2 = await cmd(page, 'get_quantities')
ok(near(qt(q2, 'Alvenaria E2E'), 87.08), 'após reabrir: Alvenaria = 87,08 m²', String(qt(q2, 'Alvenaria E2E')))
ok(near(qt(q2, 'Piso E2E'), 58.5), 'após reabrir: Piso = 58,50 m²', String(qt(q2, 'Piso E2E')))
const ms = await cmd(page, 'list_markups')
ok((ms.data?.markups ?? ms.data ?? []).length === 3, 'após reabrir: 3 marcações', ms.text?.slice(0, 120))

// ---------- exportações ----------
console.log('Exportações: PDF com tarja definitiva e planilha Excel')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const XLSX = await import('xlsx')
const textosDe = async (file) => {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true }).promise
  const out = []
  for (let i = 1; i <= doc.numPages; i++) out.push(...(await (await doc.getPage(i)).getTextContent()).items.map((t) => t.str))
  return out.join(' ')
}
const originalTxt = await textosDe(pdf)
ok(originalTxt.includes('QUARTO 2') && originalTxt.includes('QUARTO 1'), 'PDF original tem "QUARTO 1" e "QUARTO 2"')

// tarja sobre "QUARTO 2" (posição lida do próprio app); "QUARTO 1" e "BANHO" ficam de fora
const pos = (await cmd(page, 'find_text', { query: 'QUARTO 2' })).data.matches[0]
const tj = await cmd(page, 'add_markups', { markups: [{ kind: 'redact', points: [[pos.x - 4, pos.y - 4], [pos.x + 70, pos.y + 16]] }] })
ok(!tj.error && !JSON.parse(tj.text).errors, 'tarja criada sobre "QUARTO 2"', tj.text)

const antes = new Set(readdirSync(saveDir))
await page.locator('header.topbar button[data-tip^="Exportar PDF"]').click()
await page.locator('button.btn.primary', { hasText: /^Exportar$/ }).click()
const novoArquivo = async (ext) => {
  for (let i = 0; i < 80; i++) {
    const f = readdirSync(saveDir).find((x) => !antes.has(x) && x.endsWith(ext))
    if (f) return path.join(saveDir, f)
    await page.waitForTimeout(250)
  }
  return null
}
const pdfOut = await novoArquivo('.pdf')
ok(!!pdfOut, 'PDF exportado em disco')
if (pdfOut) {
  const t = await textosDe(pdfOut)
  ok(!t.includes('QUARTO 2'), 'texto "QUARTO 2" removido do arquivo (não só coberto)', t.slice(0, 200))
  ok(t.includes('QUARTO 1') && t.includes('BANHO') && t.includes('SALA'), 'textos vizinhos preservados (QUARTO 1, BANHO, SALA)')
  const b = readFileSync(pdfOut)
  ok(b.subarray(0, 5).toString() === '%PDF-', 'arquivo começa com %PDF-')
}

await page.keyboard.press('Escape')
await page.getByRole('button', { name: /Planilha/ }).first().click()
const xlsxOut = await novoArquivo('.xlsx')
ok(!!xlsxOut, 'planilha Excel exportada em disco')
if (xlsxOut) {
  const wb = XLSX.read(readFileSync(xlsxOut))
  ok(wb.SheetNames.includes('Quantitativo') && wb.SheetNames.includes('Marcações'), 'abas Quantitativo e Marcações', wb.SheetNames.join(','))
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Quantitativo'])
  const al = rows.find((r) => r['Serviço'] === 'Alvenaria E2E'), pi = rows.find((r) => r['Serviço'] === 'Piso E2E')
  ok(al && near(al['Quantidade'], 87.08) && al['Unidade'] === 'm²', 'Excel: Alvenaria = 87,08 m²', JSON.stringify(al))
  ok(al && near(al['Total (R$)'], 8708, 0.5), 'Excel: total da alvenaria R$ 8.708,00 (87,08 × 100)', JSON.stringify(al))
  ok(pi && near(pi['Quantidade'], 58.5), 'Excel: Piso = 58,50 m²', JSON.stringify(pi))
  const marc = XLSX.utils.sheet_to_json(wb.Sheets['Marcações'])
  ok(marc.length >= 3, `Excel: aba Marcações com ${marc.length} linhas`)
}

ok(errors.length === 0, 'sem erros de JavaScript na sessão 2', errors.join(' | '))
await app.close()

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\nTudo certo')
process.exit(falhas ? 1 : 0)
