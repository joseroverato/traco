import escuro from './assets/icones-escuro.svg?raw'
import claro from './assets/icones-claro.svg?raw'

/**
 * Ícones próprios do Traço (rodada 3 do redesenho). Dois sprites com os mesmos ids: o do tema escuro e o do claro
 * (cores de função mais fortes e preenchimentos a 0,6). Só o do tema atual fica no documento; ao trocar de tema o
 * conteúdo é substituído e todo <use href="#i-…"> passa a desenhar o novo.
 *  - ícone de função: "i-<nome>", viewBox 32, usado em 32 (botão grande) ou 16 px;
 *  - glifo de interface: "g-<nome>", viewBox 12, usado em 12 ou 10 px.
 */
const SPRITE_ID = 'traco-sprite'

const temaAtual = (): 'dark' | 'light' => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

/** Coloca o sprite do tema atual no documento e o mantém em dia quando o tema muda. Idempotente. */
export function installSprite() {
  if (typeof document === 'undefined') return
  let host = document.getElementById(SPRITE_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = SPRITE_ID
    host.hidden = true
    host.setAttribute('aria-hidden', 'true')
    document.body.prepend(host)
    const el = host
    const pintar = () => {
      const t = temaAtual()
      if (el.dataset.tema === t) return
      el.dataset.tema = t
      el.innerHTML = t === 'light' ? claro : escuro
    }
    pintar()
    new MutationObserver(pintar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }
}
