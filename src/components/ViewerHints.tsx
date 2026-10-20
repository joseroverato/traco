import type { State } from '../store'
import type { Pt, Tool } from '../types'
import { t } from '../i18n'
import { Rich } from './Rich'

export interface ViewerHintsProps {
  tool: Tool
  busy: string | null
  poly: { kind: 'length' | 'area' | 'hole' | 'space' | 'solid'; points: Pt[] } | null
  symFound: boolean
  aligning: State['aligning']
  fillGap: number
}

const POLY_LABEL = { get area() { return t('viewerhints.area') }, get hole() { return t('viewerhints.vazio') }, get space() { return t('viewerhints.ambiente') }, get solid() { return t('viewerhints.solido_base') }, get length() { return t('viewerhints.comprimento') } } as const

/** Faixas de ajuda (HUD) que aparecem sobre a folha conforme a ferramenta ativa. */
export function ViewerHints({ tool, busy, poly, symFound, aligning, fillGap }: ViewerHintsProps) {
  return (
    <>
      {busy && <div className="hud busy-hud"><span className="spinner" /> {busy}</div>}
      {aligning && (
        <div className="hud">
          <Rich k="viewerhints.alinhar" vars={{ n: Math.floor(aligning.step / 2) + 1, alvo: aligning.step % 2 === 0 ? t('viewerhints.desenho_colorido_sobreposto') : t('viewerhints.desenho_base') }} />
        </div>
      )}
      {tool === 'fill' && !busy && <div className="hud"><Rich k="viewerhints.area_por_clique" vars={{ gap: fillGap }} /></div>}
      {tool === 'symbol' && !symFound && !busy && <div className="hud"><Rich k="viewerhints.contagem_automatica" /></div>}
      {tool === 'legend' && <div className="hud">{t('viewerhints.legenda_clique_onde_a_tabela')}</div>}
      {poly && (
        <div className="hud">
          <Rich k="viewerhints.poligono" vars={{ label: POLY_LABEL[poly.kind], n: poly.points.length }} />
        </div>
      )}
      {tool === 'solid' && !poly && <div className="hud"><Rich k="viewerhints.solido" /></div>}
      {tool === 'count' && <div className="hud"><Rich k="viewerhints.contagem" /></div>}
      {tool === 'calibrate' && <div className="hud">{t('viewerhints.calibrar_escala_trace_sobre_uma')}</div>}
      {tool === 'viewport' && <div className="hud">{t('viewerhints.viewport_desenhe_a_regiao_que')}</div>}
      {tool === 'stamp' && <div className="hud">{t('viewerhints.carimbo_clique_para_posicionar_variaveis')}</div>}
      {tool === 'redact' && <div className="hud">{t('viewerhints.tarja_cubra_o_trecho_a')}</div>}
      {tool === 'image' && <div className="hud">{t('viewerhints.imagem_clique_onde_a_imagem')}</div>}
    </>
  )
}
