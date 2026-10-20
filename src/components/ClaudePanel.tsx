import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Link2, Settings2, Sparkles, Square, Trash2, Wrench, X } from 'lucide-react'
import { useStore } from '../store'
import { MODELS, chat, getApiKey, setApiKey } from '../ai'
import type { ApiMessage } from '../ai'
import { TOOL_LABEL } from '../commands'
import { desktop } from '../platform'
import type { ClaudeStatus } from '../platform'
import { t } from '../i18n'
import { Rich } from './Rich'

interface Item {
  role: 'user' | 'assistant' | 'tool' | 'error'
  text: string
  ok?: boolean
}

// conversa sobrevive à troca de abas
const session: { items: Item[]; history: ApiMessage[] } = { items: [], history: [] }

const SUGGESTION_KEYS = ['claudepanel.sugestao_quantitativo', 'claudepanel.sugestao_escala', 'claudepanel.sugestao_abertas', 'claudepanel.sugestao_marcadores'] as const

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
        <b className="grow">{t('claudepanel.configuracoes_do_claude')}</b>
        <button className="icon-btn xs" onClick={onClose}><X size={14} /></button>
      </div>
      <label className="field">
        <span>{t('claudepanel.chave_da_api_anthropic')} {has && <em className="ok-tag"><Check size={11} /> {t('claudepanel.salva')}</em>}</span>
        <input type="password" placeholder={has ? t('claudepanel.digite_para_trocar') : t('claudepanel.sk_ant')} value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn sm primary" disabled={!key.trim()} onClick={async () => { await setApiKey(key.trim()); setKey(''); setHas(true); s.notify(t('claudepanel.chave_salva')) }}>{t('claudepanel.salvar_chave')}</button>
        {has && <button className="btn sm ghost" onClick={async () => { await setApiKey(''); setHas(false) }}>{t('claudepanel.remover')}</button>}
      </div>
      <span className="muted small">
        {desktop ? t('claudepanel.guardada_criptografada') : t('claudepanel.guardada_navegador')} {t('claudepanel.crie_a_chave')}
      </span>
      <label className="field">
        <span>{t('claudepanel.modelo')}</span>
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
      <b>{t('claudepanel.claude_desktop_mcp')}</b>
      <span className="muted small">{t('claudepanel.permite_usar_o_claude_desktop')}</span>
      {st && (
        <div className={`mcp-status ${ok ? 'ok' : 'warn'}`}>
          {ok ? t('claudepanel.configuracao_do_claude_desktop_aponta') : found.some((c) => c.hasTraco) ? t('claudepanel.a_configuracao_existe_mas_aponta') : t('claudepanel.o_traco_ainda_nao_esta')}
          {found.find((c) => c.error) && <span className="warn small"> {t('claudepanel.arquivo_de_configuracao_com_erro', { error: found.find((c) => c.error)!.error })}</span>}
          {!st.serverExists && <span className="warn small"> {t('claudepanel.servidor_mcp_nao_encontrado_em', { server: st.server })}</span>}
        </div>
      )}
      <ol className="mcp-steps small">
        <li><Rich k="claudepanel.passo_fechar" /></li>
        <li><Rich k="claudepanel.passo_conectar" /></li>
        <li><Rich k="claudepanel.passo_abrir" /></li>
      </ol>
      <div className="row">
        <button className="btn sm primary" disabled={busy} onClick={() => run(async () => { const r = await desktop!.connectClaudeDesktop(); setMsg({ ok: r.ok, text: r.ok ? t('claudepanel.configuracao_gravada_em_arquivo_s', { length: r.paths.length }) : r.message }) })}><Link2 size={14} /> {t('claudepanel.conectar')}</button>
        <button className="btn sm" disabled={busy || !desktop!.claudeTest} onClick={() => run(async () => { setMsg({ ok: true, text: t('claudepanel.testando') }); const r = await desktop!.claudeTest!(); setMsg({ ok: r.ok, text: r.ok ? r.message : `${r.message}${r.stderr ? ` — ${r.stderr.split('\n').filter(Boolean).slice(-2).join(' ')}` : ''}` }) })}>{t('claudepanel.testar_servidor')}</button>
        <button className="btn sm ghost" disabled={!desktop!.claudeLog} onClick={async () => setLog(log === null ? (await desktop!.claudeLog!()) || t('claudepanel.sem_registros') : null)}>{log === null ? t('claudepanel.ver_registro') : t('claudepanel.ocultar_registro')}</button>
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
        <button className="icon-btn xs" data-tip={t('claudepanel.nova_conversa')} onClick={clear}><Trash2 size={14} /></button>
        <button className="icon-btn xs" data-tip={t('claudepanel.configuracoes')} onClick={() => setShowSettings(!showSettings)}><Settings2 size={14} /></button>
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <div className="claude-list" ref={list}>
        {items.length === 0 && (
          <div className="claude-empty">
            <p className="muted">{t('claudepanel.peca_para_o_claude_ler')}</p>
            {!hasKey && <p className="warn small">{desktop ? t('claudepanel.configure_chave_desktop') : t('claudepanel.configure_chave')}</p>}
            {SUGGESTION_KEYS.map((k) => (
              <button key={k} className="suggestion" onClick={() => send(t(k))}>{t(k)}</button>
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
          placeholder={t('claudepanel.pergunte_ou_peca_uma_alteracao')}
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
          <button className="send stop" onClick={() => abort.current?.abort()} aria-label={t('claudepanel.parar')}><Square size={13} /></button>
        ) : (
          <button className="send" disabled={!input.trim()} onClick={() => send(input)} aria-label={t('claudepanel.enviar')}><ArrowUp size={16} /></button>
        )}
      </div>
    </div>
  )
}
