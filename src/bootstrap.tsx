import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { desktop } from './platform'
import { TOOLS, runCommand } from './commands'

/** Liga o app. Fica separado de main.tsx para só ser carregado depois do idioma estar definido (o store já nasce com textos no idioma certo). */
export function start() {
  // App de PC: comandos vindos do servidor MCP (Claude Desktop) chegam pela ponte local.
  if (desktop) {
    desktop.onCommand(async (req) => {
      if (req.name === '__list_tools') return desktop!.replyCommand(req.id, { content: [{ type: 'text', text: JSON.stringify(TOOLS) }] })
      desktop!.replyCommand(req.id, await runCommand(req.name, req.args))
    })
  }
  // acesso para automação/testes
  ;(window as unknown as { __traco: unknown }).__traco = { runCommand }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
