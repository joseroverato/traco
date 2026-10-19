import type { State } from '../store'
import type { Pt, Tool } from '../types'

export interface ViewerHintsProps {
  tool: Tool
  busy: string | null
  poly: { kind: 'length' | 'area' | 'hole' | 'space' | 'solid'; points: Pt[] } | null
  symFound: boolean
  aligning: State['aligning']
  fillGap: number
}

const POLY_LABEL = { area: 'Área', hole: 'Vazio', space: 'Ambiente', solid: 'Sólido (base)', length: 'Comprimento' } as const

/** Faixas de ajuda (HUD) que aparecem sobre a folha conforme a ferramenta ativa. */
export function ViewerHints({ tool, busy, poly, symFound, aligning, fillGap }: ViewerHintsProps) {
  return (
    <>
      {busy && <div className="hud busy-hud"><span className="spinner" /> {busy}</div>}
      {aligning && (
        <div className="hud">
          Alinhar · par {Math.floor(aligning.step / 2) + 1} de 2 — clique num ponto do <b>{aligning.step % 2 === 0 ? 'desenho colorido (sobreposto)' : 'desenho base'}</b> · <b>Esc</b> cancela
        </div>
      )}
      {tool === 'fill' && !busy && <div className="hud">Área por clique — clique dentro do ambiente · <b>Shift+clique</b> desconta como vazio · aberturas até {fillGap} pt são fechadas</div>}
      {tool === 'symbol' && !symFound && !busy && <div className="hud">Contagem automática — arraste um retângulo em volta de <b>um</b> símbolo (tomada, luminária, ponto…)</div>}
      {tool === 'legend' && <div className="hud">Legenda — clique onde a tabela de quantitativo deve ficar</div>}
      {poly && (
        <div className="hud">
          {POLY_LABEL[poly.kind]} · {poly.points.length} vértice(s) — <b>Enter</b>/duplo clique finaliza · <b>Backspace</b> desfaz vértice · <b>Shift</b> trava ângulo · <b>Esc</b> cancela
        </div>
      )}
      {tool === 'count' && <div className="hud">Contagem — clique para somar · <b>Esc</b> inicia novo grupo</div>}
      {tool === 'calibrate' && <div className="hud">Calibrar escala — trace sobre uma cota conhecida (dentro de um viewport, calibra só ele)</div>}
      {tool === 'viewport' && <div className="hud">Viewport — desenhe a região que tem escala própria (ex.: detalhe 1:20)</div>}
      {tool === 'stamp' && <div className="hud">Carimbo — clique para posicionar · variáveis: {'{data} {folha} {n} {total} {autor}'}</div>}
      {tool === 'redact' && <div className="hud">Tarja — cubra o trecho a remover; nas propriedades escolha preta/branca e um texto de substituição</div>}
      {tool === 'image' && <div className="hud">Imagem — clique onde a imagem deve ficar (logo, assinatura, foto)</div>}
    </>
  )
}
