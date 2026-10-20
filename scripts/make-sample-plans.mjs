// Gera as plantas de exemplo (uma por idioma) em public/exemplo/: planta baixa genérica, vetorial, escala 1:50, folha A3 paisagem.
// Uso: node scripts/make-sample-plans.mjs   (o chinês usa a versão em inglês: a fonte padrão do PDF não tem ideogramas)
import fs from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const LABELS = {
  pt: { living: 'SALA', kitchen: 'COZINHA', shaft: 'SHAFT', bed1: 'QUARTO 1', bath: 'BANHO', bed2: 'QUARTO 2', title: 'PLANTA BAIXA', notes: 'NOTAS', n1: 'Desenho ilustrativo para', n2: 'demonstração do Traço.', n3: 'Cotas em metros.', project: 'PROJETO EXEMPLO', sub: 'RESIDÊNCIA UNIFAMILIAR · PLANTA BAIXA', scale: 'ESCALA 1:50', date: 'DATA: 10/2026', sheet: 'PRANCHA', docTitle: 'Planta baixa — exemplo', file: 'planta-exemplo.pdf' },
  en: { living: 'LIVING ROOM', kitchen: 'KITCHEN', shaft: 'SHAFT', bed1: 'BEDROOM 1', bath: 'BATH', bed2: 'BEDROOM 2', title: 'GROUND FLOOR PLAN', notes: 'NOTES', n1: 'Illustrative drawing to', n2: 'demonstrate Traço.', n3: 'Dimensions in meters.', project: 'SAMPLE PROJECT', sub: 'SINGLE-FAMILY HOUSE · FLOOR PLAN', scale: 'SCALE 1:50', date: 'DATE: 10/2026', sheet: 'SHEET', docTitle: 'Floor plan — sample', file: 'planta-exemplo.en.pdf' },
  es: { living: 'SALA', kitchen: 'COCINA', shaft: 'DUCTO', bed1: 'DORMITORIO 1', bath: 'BAÑO', bed2: 'DORMITORIO 2', title: 'PLANTA BAJA', notes: 'NOTAS', n1: 'Dibujo ilustrativo para', n2: 'demostrar Traço.', n3: 'Cotas en metros.', project: 'PROYECTO DE EJEMPLO', sub: 'VIVIENDA UNIFAMILIAR · PLANTA BAJA', scale: 'ESCALA 1:50', date: 'FECHA: 10/2026', sheet: 'PLANO', docTitle: 'Planta baja — ejemplo', file: 'planta-exemplo.es.pdf' },
  fr: { living: 'SÉJOUR', kitchen: 'CUISINE', shaft: 'GAINE', bed1: 'CHAMBRE 1', bath: 'SDB', bed2: 'CHAMBRE 2', title: 'PLAN DU REZ-DE-CHAUSSÉE', notes: 'NOTES', n1: 'Dessin illustratif pour', n2: 'démontrer Traço.', n3: 'Cotes en mètres.', project: 'PROJET EXEMPLE', sub: 'MAISON INDIVIDUELLE · PLAN RDC', scale: 'ÉCHELLE 1:50', date: 'DATE : 10/2026', sheet: 'PLANCHE', docTitle: 'Plan RDC — exemple', file: 'planta-exemplo.fr.pdf' },
  de: { living: 'WOHNEN', kitchen: 'KÜCHE', shaft: 'SCHACHT', bed1: 'ZIMMER 1', bath: 'BAD', bed2: 'ZIMMER 2', title: 'GRUNDRISS ERDGESCHOSS', notes: 'HINWEISE', n1: 'Beispielzeichnung zur', n2: 'Vorführung von Traço.', n3: 'Maße in Metern.', project: 'BEISPIELPROJEKT', sub: 'EINFAMILIENHAUS · GRUNDRISS EG', scale: 'MASSSTAB 1:50', date: 'DATUM: 10/2026', sheet: 'BLATT', docTitle: 'Grundriss — Beispiel', file: 'planta-exemplo.de.pdf' },
  it: { living: 'SOGGIORNO', kitchen: 'CUCINA', shaft: 'CAVEDIO', bed1: 'CAMERA 1', bath: 'BAGNO', bed2: 'CAMERA 2', title: 'PIANTA PIANO TERRA', notes: 'NOTE', n1: 'Disegno illustrativo per', n2: 'dimostrare Traço.', n3: 'Quote in metri.', project: 'PROGETTO DI ESEMPIO', sub: 'VILLETTA UNIFAMILIARE · PIANTA', scale: 'SCALA 1:50', date: 'DATA: 10/2026', sheet: 'TAVOLA', docTitle: 'Pianta — esempio', file: 'planta-exemplo.it.pdf' },
}
const only = process.argv[2]

for (const [lang, L] of Object.entries(LABELS)) {
if (only && only !== lang) continue

const W = 1190.55, H = 841.89
const K = 1 / (0.0254 / 72 * 50) // pt por metro em 1:50
const px = (m) => m * K
const doc = await PDFDocument.create()
const page = doc.addPage([W, H])
const font = await doc.embedFont(StandardFonts.Helvetica)
const bold = await doc.embedFont(StandardFonts.HelveticaBold)
const ink = rgb(0.1, 0.1, 0.12)
const grey = rgb(0.45, 0.45, 0.5)

const line = (x1, y1, x2, y2, t = 0.9, c = ink) => page.drawLine({ start: { x: px(x1), y: H - px(y1) }, end: { x: px(x2), y: H - px(y2) }, thickness: t, color: c })
const text = (s, x, y, size = 12, f = font, c = ink, center = true) => {
  const w = f.widthOfTextAtSize(s, size)
  page.drawText(s, { x: px(x) - (center ? w / 2 : 0), y: H - px(y) - size / 3, size, font: f, color: c })
}
const arc = (cx, cy, r, a0, a1) => {
  // quarto de círculo em linhas curtas
  const n = 14
  let prev
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    const p = [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    if (prev) line(prev[0], prev[1], p[0], p[1], 0.5, grey)
    prev = p
  }
}

/** Parede reta (horizontal 'h' ou vertical 'v'), espessura t, com vãos: porta (soleira no eixo) ou janela (vidro). */
function wall(dir, c, a, b, t, gaps = []) {
  const h = dir === 'h'
  const P = (u, v) => (h ? [u, v] : [v, u]) // (ao longo, através) → (x, y)
  const seg = (u1, u2) => {
    const [x1, y1] = P(u1, c - t / 2), [x2, y2] = P(u2, c - t / 2)
    const [x3, y3] = P(u1, c + t / 2), [x4, y4] = P(u2, c + t / 2)
    line(x1, y1, x2, y2); line(x3, y3, x4, y4)
    line(...P(u1, c - t / 2), ...P(u1, c + t / 2)); line(...P(u2, c - t / 2), ...P(u2, c + t / 2))
  }
  const sorted = [...gaps].sort((g1, g2) => g1.a - g2.a)
  let cur = a
  for (const g of sorted) {
    if (g.a > cur) seg(cur, g.a)
    cur = g.b
    if (g.type === 'door') {
      line(...P(g.a, c), ...P(g.b, c), 0.8) // soleira: fecha o ambiente para a "área por clique"
      const hinge = P(g.a, c), sgn = g.swing ?? 1
      const leaf = P(g.a, c + sgn * (g.b - g.a))
      line(...hinge, ...leaf, 0.7, grey)
      // arco da folha
      const end = P(g.b, c)
      const a0 = Math.atan2(end[1] - hinge[1], end[0] - hinge[0]), a1 = Math.atan2(leaf[1] - hinge[1], leaf[0] - hinge[0])
      let d = a1 - a0
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      arc(hinge[0], hinge[1], g.b - g.a, a0, a0 + d)
    } else {
      // janela: faces e vidros atravessando o vão (mantém o contorno fechado)
      for (const o of [-t / 2, -t / 6, t / 6, t / 2]) line(...P(g.a, c + o), ...P(g.b, c + o), o === -t / 2 || o === t / 2 ? 0.9 : 0.5)
      line(...P(g.a, c - t / 2), ...P(g.a, c + t / 2)); line(...P(g.b, c - t / 2), ...P(g.b, c + t / 2))
    }
  }
  if (cur < b) seg(cur, b)
}

// ---- casa: x 1.5..16.0, y 1.8..10.8 (paredes externas de 20 cm, internas de 10 cm)
const X0 = 1.5, X1 = 16.0, Y0 = 1.8, Y1 = 10.8, T = 0.2, t = 0.1
const win = (a, b) => ({ a, b, type: 'window' })
const door = (a, b, swing) => ({ a, b, type: 'door', swing })
wall('h', Y0 + T / 2, X0, X1, T, [win(3.4, 5.6), win(11.2, 13.4)]) // fundos
wall('h', Y1 - T / 2, X0, X1, T, [win(3.2, 4.6), win(8.4, 9.6), win(12.4, 14.0)]) // frente
wall('v', X0 + T / 2, Y0, Y1, T, [door(3.4, 4.3, 1)]) // entrada pela sala
wall('v', X1 - T / 2, Y0, Y1, T, [win(3.6, 5.2)])
// internas
wall('v', 9.0, Y0 + T, 6.5 - t / 2, t, [door(3.6, 4.5, 1)]) // sala | cozinha
wall('h', 6.5, X0 + T, X1 - T, t, [door(3.0, 3.9, -1), door(7.4, 8.3, -1), door(11.0, 11.9, -1)]) // sociais | íntimas
wall('v', 7.0, 6.5 + t / 2, Y1 - T, t)
wall('v', 10.5, 6.5 + t / 2, Y1 - T, t)

// shaft na cozinha (1,0 × 1,0 m): vira "vazio" descontado na área
const sx = 14.4, sy = 2.2, sw = 1.2
for (const [a, b, c, d] of [[sx, sy, sx + sw, sy], [sx + sw, sy, sx + sw, sy + sw], [sx + sw, sy + sw, sx, sy + sw], [sx, sy + sw, sx, sy]]) line(a, b, c, d, 0.9)
line(sx, sy, sx + sw, sy + sw, 0.5, grey); line(sx + sw, sy, sx, sy + sw, 0.5, grey)

// nomes dos ambientes
text(L.living, 5.5, 4.0, 15, bold); text(L.kitchen, 11.8, 4.3, 15, bold); text(L.shaft, sx + sw / 2, sy + sw + 0.5, 8, font, grey)
text(L.bed1, 4.4, 8.9, 13, bold); text(L.bath, 8.8, 8.9, 13, bold); text(L.bed2, 13.2, 8.9, 13, bold)
// cotas
const dimH = (x1, x2, y, label) => { line(x1, y, x2, y, 0.6, grey); line(x1, y - 0.12, x1, y + 0.12, 0.6, grey); line(x2, y - 0.12, x2, y + 0.12, 0.6, grey); text(label, (x1 + x2) / 2, y - 0.3, 9, font, grey) }
dimH(X0, X1, 0.9, '14,50')
line(0.9, Y0, 0.9, Y1, 0.6, grey); text('9,00', 0.45, (Y0 + Y1) / 2, 9, font, grey)
text(L.title, 8.75, 0.45, 13, bold)

// legenda ao lado
text(L.notes, 18.3, 2.3, 11, bold, ink, false); text(L.n1, 18.3, 3.0, 9, font, grey, false); text(L.n2, 18.3, 3.5, 9, font, grey, false)
text(L.n3, 18.3, 4.2, 9, font, grey, false)

// carimbo
page.drawRectangle({ x: px(1.5), y: H - px(14.5), width: px(18.0), height: px(2.2), borderColor: ink, borderWidth: 1.2 })
line(1.5, 13.0, 19.5, 13.0, 0.8); line(11.5, 12.3, 11.5, 14.5, 0.8); line(15.5, 12.3, 15.5, 14.5, 0.8)
text(L.project, 2.0, 12.65, 13, bold, ink, false); text(L.sub, 2.0, 13.55, 11, font, ink, false)
text(L.scale, 12.0, 12.65, 12, bold, ink, false); text(L.date, 12.0, 13.55, 10, font, ink, false)
text(L.sheet, 16.0, 12.65, 10, font, grey, false); text('01/01', 16.0, 13.55, 14, bold, ink, false)

doc.setTitle(L.docTitle)
fs.writeFileSync(new URL('../public/exemplo/' + L.file, import.meta.url), await doc.save())
console.log(lang, L.file)
}
