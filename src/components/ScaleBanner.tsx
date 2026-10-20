import { useStore } from '../store'
import { paperScale, scaleMismatch } from '../geometry'
import type { PageScale } from '../types'
import { t } from '../i18n'

/** Aviso "Folha sem escala": oferece usar a escala lida do carimbo, calibrar por cota ou escolher uma. */
export function ScaleBanner({ sheetId, detected, current, onHide }: { sheetId: string; detected: number | null; current?: PageScale; onHide: () => void }) {
  const s = useStore()
  if (current) {
    // folha com escala: só avisa se ela destoa da escrita no carimbo
    const n = detected ? scaleMismatch(current.metersPerUnit, detected) : null
    if (!detected || n === null) return null
    return (
      <div className="scale-banner" onPointerDown={(e) => e.stopPropagation()}>
        <span className="dot-warn" /> {t('scalebanner.escala_difere', { n, detected })}
        <button className="btn sm primary" onClick={() => { s.set({ scales: { ...s.scales, [sheetId]: { metersPerUnit: paperScale(detected), label: `1:${detected}` } } }); s.notify(t('scalebanner.escala_1_aplicada_lida_do', { detected })); onHide() }}>{t('scalebanner.usar_1', { detected })}</button>
        <button className="btn sm ghost" onClick={onHide} data-tip={t('scalebanner.mantem_a_escala_atual_ex')}>{t('scalebanner.manter_1', { n })}</button>
      </div>
    )
  }
  return (
    <div className="scale-banner" onPointerDown={(e) => e.stopPropagation()}>
      <span className="dot-warn" /> {t('scalebanner.folha_sem_escala')}
      {detected && (
        <button className="btn sm primary" onClick={() => { s.set({ scales: { ...s.scales, [sheetId]: { metersPerUnit: paperScale(detected), label: `1:${detected}` } } }); s.notify(t('scalebanner.escala_1_aplicada_lida_do', { detected })) }}>{t('scalebanner.usar_1_do_carimbo', { detected })}</button>
      )}
      <button className="btn sm" onClick={() => s.set({ tool: 'calibrate' })}>{t('scalebanner.calibrar_por_cota')}</button>
      <button className="btn sm ghost" onClick={() => s.set({ calibrating: { page: sheetId, length: 0 } })}>{t('scalebanner.escolher_escala')}</button>
      <button className="icon-btn xs" onClick={onHide} aria-label={t('scalebanner.fechar')}>✕</button>
    </div>
  )
}
