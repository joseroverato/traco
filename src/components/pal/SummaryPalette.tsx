import { useMemo } from 'react'
import { useStore } from '../../store'
import { buildSolids3D, layerTotals, LAYER_LABEL } from '../../solids'
import type { LayerKind } from '../../solids'
import { fmtQty } from '../../units'
import { t } from '../../i18n'

const LAYERS = Object.keys(LAYER_LABEL) as LayerKind[]

/** Resumo da folha (modo 3D): quantas peças há em cada camada do volume e o volume de cada uma. */
export function SummaryPalette() {
  const sheet = useStore((s) => s.sheets[s.page])
  const markups = useStore((s) => s.markups)
  const presets = useStore((s) => s.presets)
  const scales = useStore((s) => s.scales)
  const totals = useMemo(() => (sheet ? layerTotals(buildSolids3D({ page: sheet.id, markups, presets, scales })) : null), [sheet, markups, presets, scales])
  if (!totals) return <p className="pvz">{t('view3d.nada_para_mostrar_ainda')}</p>
  return (
    <>
      <table className="qt" aria-label={t('view3d.resumo_da_folha')}>
        <colgroup><col /><col style={{ width: 36 }} /><col style={{ width: 84 }} /></colgroup>
        <thead><tr><th scope="col">{t('pal.camada')}</th><th scope="col" className="num">{t('pal.n_abrev')}</th><th scope="col" className="num">{t('pal.volume')}</th></tr></thead>
        <tbody>
          {LAYERS.map((k) => (
            <tr key={k}><td>{LAYER_LABEL[k]}</td><td className="num">{totals[k].n}</td><td className="num">{k === 'count' || !totals[k].n ? '—' : fmtQty(totals[k].volume, 'm³')}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="pvz">{t('pal.nota_3d_laje')}</p>
    </>
  )
}
