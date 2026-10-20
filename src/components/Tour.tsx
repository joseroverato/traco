import { useEffect, useLayoutEffect, useState } from 'react'
import { useStore } from '../store'
import { TOUR_STEPS, markTourDone, nextStep } from '../tour'
import { t } from '../i18n'

/** Passo a passo: escurece a tela, destaca um elemento e explica em um balão. */
export function Tour() {
  const step = useStore((s) => s.tour)
  const hasDoc = useStore((s) => s.sheets.length > 0)
  const hasScale = useStore((s) => { const sh = s.sheets[s.page]; return !!sh && !!s.scales[sh.id] })
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

  // passo 1 (escala): assim que a folha ganha escala, segue para o próximo
  useEffect(() => {
    if (step !== 0 || !hasScale) return
    const t = setTimeout(() => go(1, 1), 700)
    return () => clearTimeout(t)
  }, [step, hasScale]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="tour" role="dialog" aria-label={t('tour.passo_a_passo')}>
      <div className="tour-spot" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      <div className="tour-bubble" style={{ left, top, width: W }}>
        <div className="tour-step">{t('tour.passo_a_passo_de', { v: step + 1, total })}</div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        <div className="tour-actions">
          <button className="btn sm ghost" onClick={end}>{t('tour.pular')}</button>
          <span className="grow" />
          {prev !== null && <button className="btn sm" onClick={() => go(step - 1, -1)}>{t('tour.voltar')}</button>}
          <button className="btn sm primary" onClick={() => (next === null ? end() : go(step + 1, 1))}>{next === null ? t('tour.concluir') : t('tour.proximo')}</button>
        </div>
      </div>
    </div>
  )
}
