// Traço — processo principal do app de PC (Electron)
const { app, BrowserWindow, ipcMain, dialog, protocol, net, safeStorage, shell, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')

// nome ASCII: evita acentos no user-agent e nas pastas de dados
app.setName('Traco')
app.setPath('userData', path.join(app.getPath('appData'), 'Traco'))
const USER = app.getPath('userData')
const DIST = path.join(__dirname, '..', 'dist-desktop')
let win = null
let pendingOpen = process.argv.slice(app.isPackaged ? 1 : 2).find((a) => /\.(pdf|traco)$/i.test(a)) ?? null

// um único Traço aberto; arquivos abertos depois vão para a mesma janela
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', (_e, argv) => {
  const f = argv.find((a) => /\.(pdf|traco)$/i.test(a))
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
    if (f) win.webContents.send('traco:open-path', f)
  }
})

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#161618',
    title: 'Traço',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  })
  win.loadURL('app://traco/index.html')
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-finish-load', () => {
    if (pendingOpen) {
      win.webContents.send('traco:open-path', pendingOpen)
      pendingOpen = null
    }
  })
  // pergunta antes de fechar com alterações não salvas
  win.on('close', (e) => {
    if (!dirty || forceClose) return
    e.preventDefault()
    const r = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Salvar', 'Não salvar', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      title: 'Traço',
      message: 'Salvar as alterações do projeto antes de fechar?',
      detail: 'Se não salvar, as alterações desde o último salvamento serão perdidas.',
    })
    if (r === 0) win.webContents.send('traco:save-and-close')
    else if (r === 1) {
      clearRecovery()
      forceClose = true
      win.close()
    }
  })
  win.on('closed', () => (win = null))
}
let dirty = false
let forceClose = false
ipcMain.on('app:dirty', (_e, v) => (dirty = !!v))
ipcMain.on('app:close-now', () => {
  forceClose = true
  win?.close()
})

// ---------------- salvamento automático / recuperação ----------------
const REC = path.join(USER, 'recovery.traco')
const REC_INFO = path.join(USER, 'recovery.json')
function clearRecovery() {
  for (const f of [REC, REC_INFO]) {
    try {
      fs.unlinkSync(f)
    } catch {
      /* ok */
    }
  }
}
ipcMain.handle('recovery:write', (_e, data, info) => {
  fs.mkdirSync(USER, { recursive: true })
  fs.writeFileSync(REC + '.tmp', typeof data === 'string' ? data : Buffer.from(data))
  fs.renameSync(REC + '.tmp', REC)
  fs.writeFileSync(REC_INFO, info)
})
ipcMain.handle('recovery:info', () => (fs.existsSync(REC) && fs.existsSync(REC_INFO) ? fs.readFileSync(REC_INFO, 'utf8') : null))
ipcMain.handle('recovery:read', () => (fs.existsSync(REC) ? fs.readFileSync(REC) : null))
ipcMain.handle('recovery:clear', () => clearRecovery())

// ---------------- arquivos ----------------
const readAsPayload = (p) => {
  const buf = fs.readFileSync(p)
  return { name: path.basename(p), path: p, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }
}
ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'PDF ou projeto Traço', extensions: ['pdf', 'traco'] }], properties: ['openFile'] })
  return r.canceled ? null : readAsPayload(r.filePaths[0])
})
ipcMain.handle('file:read', (_e, p) => readAsPayload(p))
ipcMain.handle('file:save', async (_e, { defaultName, data, filters, path: target }) => {
  let p = target
  // automação/testes: grava direto numa pasta, sem diálogo
  if (!p && process.env.TRACO_SAVE_DIR) p = path.join(process.env.TRACO_SAVE_DIR, defaultName)
  if (!p) {
    const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters })
    if (r.canceled || !r.filePath) return null
    p = r.filePath
  }
  fs.writeFileSync(p, typeof data === 'string' ? data : Buffer.from(data))
  return p
})

// ---------------- segredos (chave da API) ----------------
const SECRETS = path.join(USER, 'secrets.json')
const readSecrets = () => {
  try {
    return JSON.parse(fs.readFileSync(SECRETS, 'utf8'))
  } catch {
    return {}
  }
}
ipcMain.handle('secret:get', (_e, k) => {
  const v = readSecrets()[k]
  if (!v) return null
  try {
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(v, 'base64')) : Buffer.from(v, 'base64').toString()
  } catch {
    return null
  }
})
ipcMain.handle('secret:set', (_e, k, v) => {
  const all = readSecrets()
  if (!v) delete all[k]
  else all[k] = (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(v) : Buffer.from(v)).toString('base64')
  fs.mkdirSync(USER, { recursive: true })
  fs.writeFileSync(SECRETS, JSON.stringify(all))
})

ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, userData: USER }))

// ---------------- atualização automática (GitHub privado) ----------------
const UPDATE_REPO = { owner: 'joseroverato', repo: 'traco' }
let updater = null
let updateState = { status: 'idle' }
const sendUpdate = (patch) => {
  updateState = { ...updateState, ...patch }
  win?.webContents.send('traco:update', updateState)
}
function getSecretSync(k) {
  const v = readSecrets()[k]
  if (!v) return null
  try {
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(v, 'base64')) : Buffer.from(v, 'base64').toString()
  } catch {
    return null
  }
}
function getUpdater() {
  if (!app.isPackaged) return null
  const token = getSecretSync('github-token')
  if (!token) return null
  if (!updater) {
    updater = require('electron-updater').autoUpdater
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = true
    updater.on('checking-for-update', () => sendUpdate({ status: 'checking', error: null }))
    updater.on('update-available', (i) => sendUpdate({ status: 'available', version: i.version, notes: typeof i.releaseNotes === 'string' ? i.releaseNotes : '' }))
    updater.on('update-not-available', () => sendUpdate({ status: 'latest', checkedAt: Date.now() }))
    updater.on('download-progress', (p) => sendUpdate({ status: 'downloading', percent: Math.round(p.percent) }))
    updater.on('update-downloaded', (i) => sendUpdate({ status: 'ready', version: i.version }))
    updater.on('error', (e) => sendUpdate({ status: 'error', error: String(e?.message ?? e).split('\n')[0] }))
  }
  updater.setFeedURL({ provider: 'github', ...UPDATE_REPO, private: true, token })
  process.env.GH_TOKEN = token
  return updater
}
ipcMain.handle('update:state', () => ({ ...updateState, version: updateState.version, current: app.getVersion(), configured: !!getSecretSync('github-token'), packaged: app.isPackaged }))
ipcMain.handle('update:check', async () => {
  const u = getUpdater()
  if (!u) return sendUpdate({ status: 'error', error: app.isPackaged ? 'Cole o token do GitHub para ativar as atualizações.' : 'Atualização só funciona no app instalado.' })
  try {
    await u.checkForUpdates()
  } catch (e) {
    sendUpdate({ status: 'error', error: String(e?.message ?? e).split('\n')[0] })
  }
})
ipcMain.handle('update:download', async () => {
  const u = getUpdater()
  if (u) await u.downloadUpdate().catch((e) => sendUpdate({ status: 'error', error: String(e?.message ?? e) }))
})
ipcMain.handle('update:install', () => {
  const u = getUpdater()
  if (!u) return
  forceClose = true
  u.quitAndInstall(true, true)
})

// ---------------- motor completo ----------------
let engineP = null
const engine = () => (engineP ??= import(pathToFileURL(path.join(__dirname, 'engine.mjs')).href))
ipcMain.handle('engine:redact', async (_e, pdf, items) => (await engine()).redact(pdf, items))
ipcMain.handle('engine:ocr', async (_e, png) => (await engine()).ocr(png, path.join(USER, 'ocr-cache')))

// ---------------- ponte local para o servidor MCP ----------------
const pending = new Map()
ipcMain.on('traco:command-result', (_e, { id, result }) => {
  const p = pending.get(id)
  if (p) {
    pending.delete(id)
    p(result)
  }
})
function runInRenderer(name, args) {
  return new Promise((resolve) => {
    if (!win) return resolve({ content: [{ type: 'text', text: 'O Traço não está com nenhuma janela aberta.' }], isError: true })
    const id = crypto.randomUUID()
    const t = setTimeout(() => {
      pending.delete(id)
      resolve({ content: [{ type: 'text', text: 'Tempo esgotado esperando o Traço responder.' }], isError: true })
    }, 120000)
    pending.set(id, (r) => {
      clearTimeout(t)
      resolve(r)
    })
    win.webContents.send('traco:command', { id, name, args })
  })
}
function startBridge() {
  const token = crypto.randomBytes(24).toString('hex')
  const srv = http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401).end()
      return
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', async () => {
      try {
        const { name, args } = JSON.parse(body || '{}')
        const result = await runInRenderer(name, args ?? {})
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(500).end(JSON.stringify({ content: [{ type: 'text', text: String(e) }], isError: true }))
      }
    })
  })
  srv.listen(0, '127.0.0.1', () => {
    fs.mkdirSync(USER, { recursive: true })
    fs.writeFileSync(path.join(USER, 'bridge.json'), JSON.stringify({ port: srv.address().port, token, pid: process.pid }))
  })
  app.on('will-quit', () => {
    try {
      fs.unlinkSync(path.join(USER, 'bridge.json'))
    } catch {
      /* ok */
    }
  })
}

// ---------------- conectar ao Claude Desktop ----------------
function claudeConfigPaths() {
  const out = [path.join(app.getPath('appData'), 'Claude', 'claude_desktop_config.json')]
  if (process.platform === 'win32') {
    // versão da Microsoft Store (MSIX) guarda a configuração em outra pasta
    const pk = path.join(process.env.LOCALAPPDATA || '', 'Packages')
    try {
      for (const d of fs.readdirSync(pk)) if (/^Claude_/i.test(d)) out.push(path.join(pk, d, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'))
    } catch {
      /* sem pasta Packages */
    }
  }
  return out
}
ipcMain.handle('claude:connect', () => {
  const server = app.isPackaged ? path.join(process.resourcesPath, 'mcp-server.cjs') : path.join(__dirname, 'build', 'mcp-server.cjs')
  const entry = { command: process.execPath, args: [server], env: { ELECTRON_RUN_AS_NODE: '1' } }
  const written = []
  for (const p of claudeConfigPaths()) {
    const dir = path.dirname(p)
    if (!fs.existsSync(dir) && written.length) continue
    try {
      fs.mkdirSync(dir, { recursive: true })
      let cfg = {}
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        fs.writeFileSync(p + '.bak', raw)
        cfg = raw.trim() ? JSON.parse(raw) : {}
      }
      cfg.mcpServers = { ...(cfg.mcpServers || {}), traco: entry }
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2))
      written.push(p)
    } catch (e) {
      return { ok: false, message: `Não foi possível escrever ${p}: ${e.message}`, paths: written }
    }
  }
  return { ok: true, message: 'Pronto! Feche e abra o Claude Desktop. O Traço aparece em Conectores como "traco".', paths: written }
})

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url)
    let p = path.normalize(path.join(DIST, decodeURIComponent(u.pathname)))
    if (!p.startsWith(DIST)) return new Response('proibido', { status: 403 })
    if (!fs.existsSync(p)) p = path.join(DIST, 'index.html')
    return net.fetch(pathToFileURL(p).href)
  })
  Menu.setApplicationMenu(null)
  startBridge()
  createWindow()
  // verifica atualização alguns segundos depois de abrir (se o token estiver configurado)
  setTimeout(() => {
    const u = getUpdater()
    if (u) u.checkForUpdates().catch(() => {})
  }, 8000)
})
app.on('window-all-closed', async () => {
  try {
    if (engineP) await (await engineP).shutdown()
  } catch {
    /* ok */
  }
  app.quit()
})
