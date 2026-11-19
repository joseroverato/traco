/**
 * Dicas "aquecidas": a primeira dica espera o atraso normal; depois que uma abriu, as vizinhas abrem na hora e sem animação,
 * para dar para percorrer uma barra de ferramentas lendo os nomes. Passado um instante sem dica nenhuma, volta a esperar.
 * O estado fica em <html data-tip-warm>: o CSS das dicas simples (`[data-tip]`) lê dali, e a dica rica (RichTip) consulta por função.
 */
const OPEN_MS = 350 // igual ao atraso da dica simples no index.css
const COOL_MS = 300

let openTimer: number | undefined
let coolTimer: number | undefined
let started = false
let cooling = false // há um esfriamento agendado

const root = () => document.documentElement

export const tipIsWarm = () => typeof document !== 'undefined' && root().dataset.tipWarm === '1'

/** Uma dica apareceu: as próximas não esperam. */
export function tipOpened() {
  window.clearTimeout(coolTimer)
  cooling = false
  root().dataset.tipWarm = '1'
}

/** A dica sumiu: se nenhuma outra abrir logo, volta ao atraso normal. */
export function tipClosed() {
  window.clearTimeout(openTimer)
  window.clearTimeout(coolTimer)
  cooling = true
  coolTimer = window.setTimeout(() => {
    cooling = false
    delete root().dataset.tipWarm
  }, COOL_MS)
}

const tipOf = (t: EventTarget | null) => (t instanceof Element ? t.closest('[data-tip]') : null)

/** Liga o acompanhamento das dicas simples. Chamar uma vez, ao abrir o app. */
export function startTipWarmth() {
  if (started || typeof document === 'undefined') return
  started = true
  document.addEventListener('pointerover', (e) => {
    if (!tipOf(e.target)) {
      // o botão com a dica pode ter sumido debaixo do ponteiro (recolher um painel): sem pointerout, é aqui que começa a esfriar
      if (tipIsWarm() && !cooling) tipClosed()
      return
    }
    cooling = false
    window.clearTimeout(coolTimer)
    if (tipIsWarm()) return
    window.clearTimeout(openTimer)
    openTimer = window.setTimeout(tipOpened, OPEN_MS)
  })
  document.addEventListener('pointerout', (e) => {
    if (!tipOf(e.target) || tipOf(e.relatedTarget)) return // saiu de uma dica direto para outra: continua aquecido
    tipClosed()
  })
}
