// Servidor MCP do Traço — o Claude Desktop inicia este processo (stdio) e ele conversa
// com o Traço aberto pela ponte local (127.0.0.1). Se o Traço estiver fechado, abre-o.
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import TOOLS from '../src/tools.json'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'))
const BRIDGE = path.join(appData, 'Traco', 'bridge.json')

function readBridge() {
  try {
    return JSON.parse(fs.readFileSync(BRIDGE, 'utf8'))
  } catch {
    return null
  }
}

function post(b, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request({ host: '127.0.0.1', port: b.port, path: '/call', method: 'POST', headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (res) => {
      let s = ''
      res.on('data', (c) => (s += c))
      res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(s)) : reject(new Error(`ponte respondeu ${res.statusCode}`))))
    })
    req.on('error', reject)
    req.end(data)
  })
}

async function launchApp() {
  // process.execPath é o Traço.exe (rodando como Node via ELECTRON_RUN_AS_NODE)
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  spawn(process.execPath, (process.env.TRACO_LAUNCH_ARGS || '').split(' ').filter(Boolean), { detached: true, stdio: 'ignore', env }).unref()
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const b = readBridge()
    if (b) {
      try {
        await post(b, { name: 'get_document', args: {} })
        return b
      } catch {
        /* ainda iniciando */
      }
    }
  }
  return null
}

async function call(name, args) {
  let b = readBridge()
  try {
    if (!b) throw new Error('sem ponte')
    return await post(b, { name, args })
  } catch {
    b = await launchApp()
    if (!b) return { content: [{ type: 'text', text: 'Não consegui abrir o Traço. Abra o app manualmente e tente de novo.' }], isError: true }
    return post(b, { name, args })
  }
}

const server = new Server({ name: 'traco', version: '1.0.0' }, { capabilities: { tools: {} }, instructions: 'Ferramentas do Traço (revisão de pranchas e quantitativos). Coordenadas em pt, origem no canto superior esquerdo, y para baixo. Olhe a folha (get_sheet_image) antes de desenhar.' })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })),
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const r = await call(req.params.name, req.params.arguments ?? {})
  return { content: r.content.map((c) => (c.type === 'image' ? { type: 'image', data: c.data, mimeType: c.mimeType || 'image/png' } : { type: 'text', text: c.text ?? '' })), isError: !!r.isError }
})

server.connect(new StdioServerTransport()).catch((e) => {
  console.error(e)
  process.exit(1)
})
