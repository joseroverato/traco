/**
 * Botões só com ícone ganham nome para leitores de tela: usa o texto de dica (title / data-tip) que eles já têm.
 * Fica num observador único em vez de um aria-label em cada botão, para nenhum botão novo ficar de fora.
 */
export function labelIconButtons(root: ParentNode = document) {
  for (const b of root.querySelectorAll('button:not([aria-label]),[role=button]:not([aria-label])')) {
    if (b.textContent?.trim()) continue
    const label = b.getAttribute('title') || b.getAttribute('data-tip')
    if (label) b.setAttribute('aria-label', label)
  }
}

export function installAutoLabels() {
  labelIconButtons()
  let timer = 0
  new MutationObserver(() => {
    if (timer) return
    timer = window.setTimeout(() => {
      timer = 0
      labelIconButtons()
    }, 250)
  }).observe(document.body, { childList: true, subtree: true })
}
