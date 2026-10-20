/** Conversa com o Claude (API de Mensagens) usando os comandos do Traço como ferramentas. */
import { TOOLS, runCommand } from './commands'
import { LANGS, getLang, t } from './i18n'
import { desktop } from './platform'
import { useStore } from './store'

export const MODELS = [
  { id: 'claude-sonnet-5-5', get label() { return t('ai.claude_sonnet_5_5_equilibrado') } },
  { id: 'claude-opus-5-5', get label() { return t('ai.claude_opus_5_5_mais') } },
  { id: 'claude-haiku-5-5', get label() { return t('ai.claude_haiku_5_5_mais') } },
]

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: Block[] | string; is_error?: boolean }
export interface ApiMessage {
  role: 'user' | 'assistant'
  content: Block[] | string
}

const systemPrompt = () => `Você é o assistente de engenharia integrado ao Traço, o app de revisão de pranchas e levantamento de quantitativos.
O usuário é engenheiro civil. Responda de forma direta e técnica, no idioma em que ele escrever (o idioma da interface do app é ${LANGS.find((l) => l.id === getLang())!.name}).

Como trabalhar:
- Use as ferramentas para ler e alterar o projeto aberto. Comece por get_document quando não souber o contexto.
- Coordenadas: pontos PDF (pt), origem no canto superior esquerdo da folha como exibida, x → direita, y ↓ baixo.
- Antes de desenhar marcações, olhe a folha com get_sheet_image (amplie com 'region' quando precisar de precisão) e/ou use get_sheet_text para localizar ambientes e cotas. Converta pixels em pt com px_per_pt e origin_pt.
- Medidas só valem com escala definida (folha ou viewport). Se faltar, confira o carimbo/legenda da prancha e proponha set_scale.
- Para quantitativo, use marcadores (presets) compatíveis: área → measure 'area', comprimento → 'length', contagem → 'count'. Crie marcadores com upsert_preset quando não existir um adequado (com grupo e, se souber, código SINAPI).
- Desenhos feitos por você são aproximados: avise o usuário para conferir, e cite os ids criados. Tudo pode ser desfeito com Ctrl+Z.
- Peça confirmação antes de excluir muitas marcações ou renomear várias folhas.
- Ao terminar, resuma o que foi feito em poucas linhas (quantidades com unidade).`

export async function getApiKey() {
  if (desktop) return (await desktop.getSecret('anthropic')) ?? ''
  try {
    return localStorage.getItem('traco.apikey') ?? ''
  } catch {
    return ''
  }
}
export async function setApiKey(k: string) {
  if (desktop) return desktop.setSecret('anthropic', k)
  try {
    localStorage.setItem('traco.apikey', k)
  } catch {
    /* sem storage */
  }
}

/** Remove imagens antigas do histórico para economizar contexto. */
function prune(msgs: ApiMessage[]): ApiMessage[] {
  let userTurns = 0
  return [...msgs]
    .reverse()
    .map((m) => {
      if (m.role === 'user') userTurns++
      if (userTurns <= 3 || typeof m.content === 'string') return m
      return {
        ...m,
        content: m.content.map((b) =>
          b.type === 'tool_result' && Array.isArray(b.content)
            ? { ...b, content: b.content.map((c) => (c.type === 'image' ? ({ type: 'text', text: t('ai.imagem_anterior_omitida') } as Block) : c)) }
            : b,
        ),
      }
    })
    .reverse()
}

export interface ChatEvents {
  onAssistantText: (text: string) => void
  onTool: (name: string, input: Record<string, unknown>, ok: boolean) => void
}

export async function chat(history: ApiMessage[], ev: ChatEvents, signal: AbortSignal): Promise<ApiMessage[]> {
  const key = await getApiKey()
  if (!key) throw new Error(t('ai.configure_sua_chave_da_api'))
  const model = useStore.getState().claudeModel
  let msgs = history
  for (let turn = 0; turn < 25; turn++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt(), tools: TOOLS, messages: prune(msgs) }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = (await res.json())?.error?.message ?? ''
      } catch {
        detail = await res.text()
      }
      if (res.status === 401) throw new Error(t('ai.chave_da_api_invalida_confira'))
      throw new Error(t('ai.erro_da_api', { status: res.status, detail }))
    }
    const data = (await res.json()) as { content: Block[]; stop_reason: string }
    msgs = [...msgs, { role: 'assistant', content: data.content }]
    const text = data.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map((b) => b.text).join('\n').trim()
    if (text) ev.onAssistantText(text)
    if (data.stop_reason !== 'tool_use') return msgs
    const results: Block[] = []
    for (const b of data.content) {
      if (b.type !== 'tool_use') continue
      const r = await runCommand(b.name, b.input)
      ev.onTool(b.name, b.input, !r.isError)
      results.push({
        type: 'tool_result',
        tool_use_id: b.id,
        is_error: r.isError || undefined,
        content: r.content.map((c) => (c.type === 'image' ? { type: 'image', source: { type: 'base64', media_type: c.mimeType ?? 'image/png', data: c.data! } } : { type: 'text', text: c.text ?? '' })),
      })
    }
    msgs = [...msgs, { role: 'user', content: results }]
  }
  return msgs
}
