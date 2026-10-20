// Teste da atualização automática: abre uma versão ANTIGA do Traço, procura atualização na release pública do GitHub,
// baixa e confere que fica pronta para instalar. Não instala a nova versão por cima: só chega até "pronta".
// A versão antiga vem de TRACO_OLD_EXE (pasta já instalada/descompactada, ex.: release/win-unpacked/Traco.exe de uma
// versão anterior) ou de TRACO_OLD_SETUP (instalador; precisa de permissão de administrador, então não roda sem tela).
import { _electron as electron } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const setup = process.env.TRACO_OLD_SETUP
let exe = process.env.TRACO_OLD_EXE
if (!exe && (!setup || !existsSync(setup))) throw new Error('Defina TRACO_OLD_EXE (app antigo descompactado) ou TRACO_OLD_SETUP (instalador antigo).')
const dir = mkdtempSync(path.join(tmpdir(), 'traco-old-'))
const userData = mkdtempSync(path.join(tmpdir(), 'traco-old-data-'))
let falhas = 0
const ok = (c, m, extra = '') => { console.log(`${c ? '  ok  ' : ' FALHA'}  ${m}${c ? '' : '  ' + extra}`); if (!c) falhas++ }

if (!exe) {
  console.log('Instalando a versão antiga em pasta temporária…')
  execFileSync(path.resolve(setup), ['/S', `/D=${dir}`], { stdio: 'ignore', timeout: 180000 })
  exe = path.join(dir, 'Traco.exe')
}
ok(existsSync(exe), 'versão antiga disponível')

const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`] })
const page = await app.firstWindow()
await page.waitForSelector('input[type=file]', { state: 'attached' })
const antiga = await page.evaluate(() => window.traco.update.state())
console.log('  versão instalada:', antiga.current)

await page.evaluate(() => window.traco.update.check())
let st = null
for (let i = 0; i < 60; i++) {
  st = await page.evaluate(() => window.traco.update.state())
  if (['available', 'idle', 'error'].includes(st.status) && st.status !== 'checking') break
  await page.waitForTimeout(500)
}
ok(st.status === 'available', `encontrou atualização (${st.version ?? '—'}) sem token`, JSON.stringify(st))

if (st.status === 'available') {
  await page.evaluate(() => window.traco.update.download())
  for (let i = 0; i < 240; i++) {
    st = await page.evaluate(() => window.traco.update.state())
    if (st.status === 'ready' || st.status === 'error') break
    await page.waitForTimeout(1000)
  }
  ok(st.status === 'ready', `download concluído e pronto para instalar (${st.version})`, JSON.stringify(st))
}
await app.close()
if (!process.env.TRACO_OLD_EXE) try { rmSync(dir, { recursive: true, force: true }) } catch { /* pode estar em uso */ }
console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\nTudo certo')
process.exit(falhas ? 1 : 0)
