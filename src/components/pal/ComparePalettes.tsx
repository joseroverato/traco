import { useCompareShare } from '../../compareShare'
import { t } from '../../i18n'

/** Regiões alteradas (modo Comparar): lista numerada; clicar leva a vista até a região. */
export function RegionsPalette() {
  const { regions, busy, goTo } = useCompareShare()
  if (busy) return <p className="pvz">{t('compareview.analisando')}</p>
  if (!regions.length) return <p className="pvz">{t('pal.nenhuma_regiao_alterada')}</p>
  return (
    <table className="qt" aria-label={t('pal.regioes_alteradas')}>
      <colgroup><col style={{ width: 34 }} /><col /><col style={{ width: 70 }} /></colgroup>
      <thead><tr><th scope="col" className="num">{t('pal.n_abrev')}</th><th scope="col" className="num">{t('pal.tamanho_pt')}</th><th scope="col" className="num">{t('pal.dif_px')}</th></tr></thead>
      <tbody>
        {regions.map((r, i) => (
          <tr key={i} tabIndex={0} onClick={() => goTo(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(i) } }}>
            <td className="num"><b>{i + 1}</b></td>
            <td className="num">{r.w}×{r.h}</td>
            <td className="num">{r.px}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Legenda de cores da comparação (só na antiga, só na nova, igual nas duas). */
export function LegendPalette() {
  return (
    <div className="lgd">
      <div><i className="sw red" />{t('compareview.so_na_antiga_removido')}</div>
      <div><i className="sw blue" />{t('compareview.so_na_nova_acrescentado')}</div>
      <div><i className="sw black" />{t('compareview.igual_nas_duas')}</div>
    </div>
  )
}
