import { useLayoutEffect, useRef, useState } from 'react'

interface Box { x: number; y: number; w: number; h: number }
const same = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)

/**
 * Indicador que desliza até o botão ativo de uma fileira de abas (`.tabs`) ou de um seletor (`.seg`).
 * Basta colocá-lo como primeiro filho: ele acha sozinho o `button.active` e acompanha troca de aba, de idioma e de tamanho.
 * Só usa transform e tamanho próprio (é absoluto, não empurra ninguém). Aparece já no lugar; só desliza a partir da segunda posição.
 */
export function TabPill() {
  const el = useRef<HTMLElement>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [moving, setMoving] = useState(false)

  useLayoutEffect(() => {
    const host = el.current?.parentElement
    if (!host) return
    const place = () => {
      const b = host.querySelector<HTMLElement>(':scope > button.active')
      const next = b ? { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight } : null
      setBox((old) => (same(old, next) ? old : next))
    }
    place()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    ro?.observe(host)
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(place)
    // classe (troca de aba), filhos e texto (idioma, contadores): tudo que pode mudar a posição do botão ativo sem mudar o tamanho da fileira
    mo?.observe(host, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true })
    // a transição só liga depois da primeira posição, para o indicador não vir deslizando do canto ao abrir
    const timer = window.setTimeout(() => setMoving(true), 60)
    return () => {
      ro?.disconnect()
      mo?.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <i
      ref={el}
      aria-hidden
      className={`tab-pill ${moving ? 'moving' : ''}`}
      style={box ? { transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h } : { opacity: 0 }}
    />
  )
}
