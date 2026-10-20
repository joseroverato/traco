import { useEffect, useLayoutEffect, useState } from 'react'
import { useStore } from '../store'
import { TOUR_STEPS, markTourDone, nextStep } from '../tour'

/** Passo a passo: escurece a tela, destaca um elemento e explica em um balão. */
export function Tour() {
  const step = useStore((s) => s.tour)
  const hasDoc = useStore((s) => s.sheets.length > 0)
  const set = useStore((s) => s.set)
  const [box, setBox] = useState<DOMRect | null>(null)
  const [tick, setTick] = useState(0)

  const end = () => { markTourDone(); set({ tour: null }) }
  const go = (from: number, dir: 1 | -1) => {
    const n = nextStep(from, dir)
    if (n === null) { if (dir === 1) end(); return }
    set({ tour: n })
  }

  // se o passo atual não tem elemento (ex.: folha já com escala), avança
  useEffect(() => {
    if (step === null || !hasDoc) return
    const t = setTimeout(() => { if (!TOUR_STEPS[step].find()) go(step + 1, 1) }, 400)
    return () => clearTimeout(t)
  }, [step, hasDoc]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (step === null) return setBox(null)
    const el = TOUR_STEPS[step].find()
    setBox(el ? el.getBoundingClientRect() : null)
  }, [step, tick])

  useEffect(() => {
    if (step === null) return
    const re = () => setTick((n) => n + 1)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') end() }
    window.addEventListener('resize', re)
    window.addEventListener('keydown', key)
    const iv = setInterval(re, 700) // painéis que abrem/fecham mudam de lugar
    return () => { window.removeEventListener('resize', re); window.removeEventListener('keydown', key); clearInterval(iv) }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  if (step === null || !box) return null
  const s = TOUR_STEPS[step]
  const total = TOUR_STEPS.length
  const W = 330, pad = 8, vw = window.innerWidth, vh = window.innerHeight
  // balão à direita do destaque; se não couber, à esquerda; se for largo, abaixo
  let left = box.right + 16, top = box.top
  if (left + W > vw - 12) left = box.left - W - 16
  if (left < 12 || box.width > vw * 0.5) { left = Math.min(Math.max(12, box.left), vw - W - 12); top = box.bottom + 16 }
  top = Math.min(Math.max(12, top), vh - 220)
  const prev = nextStep(step - 1, -1)
  const next = nextStep(step + 1, 1)

  return (
    <div className="tour" role="dialog" aria-label="Passo a passo">
      <div className="tour-spot" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      <div className="tour-bubble" style={{ left, top, width: W }}>
        <div className="tour-step">Passo a passo · {step + 1} de {total}</div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        <div className="tour-actions">
          <button className="btn sm ghost" onClick={end}>Pular</button>
          <span className="grow" />
          {prev !== null && <button className="btn sm" onClick={() => go(step - 1, -1)}>Voltar</button>}
          <button className="btn sm primary" onClick={() => (next === null ? end() : go(step + 1, 1))}>{next === null ? 'Concluir' : 'Próximo'}</button>
        </div>
      </div>
    </div>
  )
}
