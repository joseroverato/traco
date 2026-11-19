import { useStore } from '../store'
import { paperScale, scaleMismatch } from '../geometry'
import type { PageScale } from '../types'
import { t } from '../i18n'
import { Glyph } from './Icon'

/**
 * Faixa de alerta da escala (R3, seção 16): fica fixa acima da mesa, dentro da coluna central, e nunca flutua sobre a planta.
 * Folha sem escala: oferece a escala lida do carimbo ou o diálogo "Definir escala".
 * Folha com escala: só avisa quando ela destoa da escrita no carimbo.
 */
export function ScaleAlert({ sheetId, detected, current, onHide }: { sheetId: string; detected: number | null; current?: PageScale; onHide: () => void }) {
  const s = useStore()
  const applyStamp = (n: number) => {
    s.set({ scales: { ...s.scales, [sheetId]: { metersPerUnit: paperScale(n), label: `1:${n}` } } })
    s.notify(t('scalebanner.escala_1_aplicada_lida_do', { detected: n }))
  }
  const close = (
    <button className="ib" type="button" onClick={onHide} aria-label={t('scalebanner.fechar_o_aviso')} title={t('scalebanner.fechar_o_aviso')}><Glyph name="x" size={12} /></button>
  )
  if (current) {
    // folha com escala: só avisa se ela destoa do carimbo
    const n = detected ? scaleMismatch(current.metersPerUnit, detected) : null
    if (!detected || n === null) return null
    return (
      <div className="rx al-host" onPointerDown={(e) => e.stopPropagation()}>
        <div className="al info" role="status">
          <Glyph name="alerta" size={12} />
          <span><b>{t('scalebanner.escala_difere', { n, detected })}</b></span>
          <span className="sp" />
          <button className="tbn pri" type="button" onClick={() => { applyStamp(detected); onHide() }}>{t('scalebanner.usar_1', { detected })}</button>
          <button className="tbn txt" type="button" onClick={onHide} title={t('scalebanner.mantem_a_escala_atual_ex')}>{t('scalebanner.manter_1', { n })}</button>
          {close}
        </div>
      </div>
    )
  }
  return (
    <div className="rx al-host" onPointerDown={(e) => e.stopPropagation()}>
      <div className="al" role="alert">
        <Glyph name="alerta" size={12} />
        <span><b>{t('scalebanner.folha_sem_escala')}</b></span>
        <span className="sp" />
        {detected && <button className="tbn txt" type="button" onClick={() => applyStamp(detected)}>{t('scalebanner.usar_1_do_carimbo', { detected })}</button>}
        <button className="tbn pri" type="button" onClick={() => s.set({ calibrating: { page: sheetId, length: 0 } })}>{t('rightpanel.definir_escala')}</button>
        {close}
      </div>
    </div>
  )
}
