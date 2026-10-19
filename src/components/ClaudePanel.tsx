import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Link2, Settings2, Sparkles, Square, Trash2, Wrench, X } from 'lucide-react'
import { useStore } from '../store'
import { MODELS, chat, getApiKey, setApiKey } from '../ai'
import type { ApiMessage } from '../ai'
import { TOOL_LABEL } from '../commands'
import { desktop } from '../platform'
import type { ClaudeStatus } from '../platform'

interface Item {
  role: 'user' | 'assistant' | 'tool' | 'error'
  text: string
  ok?: boolean
}

// conversa sobrevive à troca de abas
const session: { items: Item[]; history: ApiMessage[] } = { items: [], history: [] }

const SUGGESTIONS = [
  'Resuma o quantitativo do projeto por disciplina',
  'Olhe esta folha e diga a escala indicada no carimbo',
  'Liste as marcações em aberto e sugira prioridades',
  'Crie marcadores para piso, rodapé e pintura do apartamento',
]

function md(t: string) {
  const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/^#{1,4} (.*)$/gm, '<b>$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m.replace(/\n/g, '')}</ul>`)
    .replace(/\n/g, '<br/>')
}

function Settings({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [key, setKey] = useState('')
  const [has, setHas] = useState(false)
  useEffect(() => {
    getApiKey().then((k) => setHas(!!k))
  }, [])
  return (
    <div className="claude-settings stack">
      <div className="row center">
        <b className="grow">Configurações do Claude</b>
        <button className="icon-btn xs" onClick={onClose}><X size={14} /></button>
      </div>
      <label className="field">
        <span>Chave da API Anthropic {has && <em className="ok-tag"><Check size={11} /> salva</em>}</span>
        <input type="password" placeholder={has ? '•••••••• (digite para trocar)' : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn sm primary" disabled={!key.trim()} onClick={async () => { await setApiKey(key.trim()); setKey(''); setHas(true); s.notify('Chave salva') }}>Salvar chave</button>
        {has && <button className="btn sm ghost" onClick={async () => { await setApiKey(''); setHas(false) }}>Remover</button>}
      </div>
      <span className="muted small">
        {desktop ? 'Guardada criptografada neste computador.' : 'Guardada só neste navegador. Em computador compartilhado, remova ao terminar.'} Crie a chave em console.anthropic.com.
      </span>
      <label className="field">
        <span>Modelo</span>
        <select value={s.claudeModel} onChange={(e) => { s.set({ claudeModel: e.target.value }); try { localStorage.setItem('traco.model', JSON.stringify(e.target.value)) } catch { /* */ } }}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      {desktop && <ClaudeDesktopCard />}
    </div>
  )
}

/** Conexão com o Claude Desktop (MCP): grava a configuração, confere e testa o servidor. */
function ClaudeDesktopCard() {
  const [st, setSt] = useState<ClaudeStatus | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const refresh = async () => setSt((await desktop!.claudeStatus?.()) ?? null)
  useEffect(() => {
    refresh()
  }, [])
  const found = st?.configs.filter((c) => c.exists) ?? []
  const ok = found.some((c) => c.current)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
      refresh()
    }
  }
  return (
    <div className="card">
      <b>Claude Desktop (MCP)</b>
      <span className="muted small">Permite usar o Claude Desktop — com a sua assinatura, sem chave de API — para ler e editar o projeto aberto no Traço.</span>
      {st && (
        <div className={`mcp-status ${ok ? 'ok' : 'warn'}`}>
          {ok ? 'Configuração do Claude Desktop aponta para este Traço.' : found.some((c) => c.hasTraco) ? 'A configuração existe, mas aponta para outra instalação do Traço. Clique em Conectar.' : 'O Traço ainda não está na configuração do Claude Desktop.'}
          {found.find((c) => c.error) && <span className="warn small"> Arquivo de configuração com erro: {found.find((c) => c.error)!.error}</span>}
          {!st.serverExists && <span className="warn small"> Servidor MCP não encontrado em {st.server}.</span>}
        </div>
      )}
      <ol className="mcp-steps small">
        <li>Feche o Claude Desktop pelo ícone da bandeja do Windows (botão direito › <b>Sair</b>). Fechar só a janela não basta: ele regrava a configuração ao sair e apaga a do Traço.</li>
        <li>Clique em <b>Conectar</b>.</li>
        <li>Abra o Claude Desktop. O Traço aparece nas ferramentas como <b>traco</b>.</li>
      </ol>
      <div className="row">
        <button className="btn sm primary" disabled={busy} onClick={() => run(async () => { const r = await desktop!.connectClaudeDesktop(); setMsg({ ok: r.ok, text: r.ok ? `Configuração gravada em ${r.paths.length} arquivo(s).` : r.message }) })}><Link2 size={14} /> Conectar</button>
        <button className="btn sm" disabled={busy || !desktop!.claudeTest} onClick={() => run(async () => { setMsg({ ok: true, text: 'Testando…' }); const r = await desktop!.claudeTest!(); setMsg({ ok: r.ok, text: r.ok ? r.message : `${r.message}${r.stderr ? ` — ${r.stderr.split('\n').filter(Boolean).slice(-2).join(' ')}` : ''}` }) })}>Testar servidor</button>
        <button className="btn sm ghost" disabled={!desktop!.claudeLog} onClick={async () => setLog(log === null ? (await desktop!.claudeLog!()) || '(sem registros ainda — o Claude Desktop não iniciou o servidor)' : null)}>{log === null ? 'Ver registro' : 'Ocultar registro'}</button>
      </div>
      {msg && <span className={`small ${msg.ok ? '' : 'warn'}`}>{msg.text}</span>}
      {log !== null && <pre className="mcp-log">{log}</pre>}
    </div>
  )
}

export function ClaudePanel() {
  const [items, setItems] = useState<Item[]>(session.items)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [hasKey, setHasKey] = useState(true)
  const abort = useRef<AbortController | null>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getApiKey().then((k) => {
      setHasKey(!!k)
      if (!k && !desktop) setShowSettings(true)
    })
  }, [showSettings])
  useEffect(() => {
    session.items = items
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [items])

  const push = (it: Item) => setItems((x) => [...x, it])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    setInput('')
    push({ role: 'user', text })
    setBusy(true)
    abort.current = new AbortController()
    try {
      session.history = await chat(
        [...session.history, { role: 'user', content: text }],
        {
          onAssistantText: (t) => push({ role: 'assistant', text: t }),
          onTool: (name, _i, ok) => push({ role: 'tool', text: TOOL_LABEL[name] ?? name, ok }),
        },
        abort.current.signal,
      )
    } catch (e) {
      if ((e as Error).name !== 'AbortError') push({ role: 'error', text: (e as Error).message })
      // descarta a pergunta que não foi concluída para não quebrar o histórico
      session.history = session.history.filter((m) => m.role === 'assistant' || m.content !== text)
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    session.history = []
    setItems([])
  }

  return (
    <div className="claude">
      <div className="claude-head">
        <Sparkles size={15} className="spark" />
        <span className="grow">Claude</span>
        <button className="icon-btn xs" data-tip="Nova conversa" onClick={clear}><Trash2 size={14} /></button>
        <button className="icon-btn xs" data-tip="Configurações" onClick={() => setShowSettings(!showSettings)}><Settings2 size={14} /></button>
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <div className="claude-list" ref={list}>
        {items.length === 0 && (
          <div className="claude-empty">
            <p className="muted">Peça para o Claude ler as pranchas, criar marcadores, medir, revisar marcações ou resumir o quantitativo.</p>
            {!hasKey && <p className="warn small">Configure a chave da API{desktop ? ' ou conecte o Claude Desktop' : ''} na engrenagem.</p>}
            {SUGGESTIONS.map((t) => (
              <button key={t} className="suggestion" onClick={() => send(t)}>{t}</button>
            ))}
          </div>
        )}
        {items.map((it, i) =>
          it.role === 'tool' ? (
            <div key={i} className={`tool-line ${it.ok ? '' : 'bad'}`}><Wrench size={11} /> {it.text}</div>
          ) : (
            <div key={i} className={`bubble ${it.role}`} dangerouslySetInnerHTML={{ __html: md(it.text) }} />
          ),
        )}
        {busy && <div className="typing"><span /><span /><span /></div>}
      </div>
      <div className="claude-input">
        <textarea
          rows={2}
          placeholder="Pergunte ou peça uma alteração…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
        />
        {busy ? (
          <button className="send stop" onClick={() => abort.current?.abort()} aria-label="Parar"><Square size={13} /></button>
        ) : (
          <button className="send" disabled={!input.trim()} onClick={() => send(input)} aria-label="Enviar"><ArrowUp size={16} /></button>
        )}
      </div>
    </div>
  )
}
