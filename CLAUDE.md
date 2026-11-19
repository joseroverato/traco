# CLAUDE.md — Traço

App de medição e revisão de pranchas em PDF (Electron 33 + React 19 + Vite + Zustand + CSS puro). Idioma: português do Brasil.

## Antes de mexer na interface
1. Leia `DESIGN.md` (sistema visual, regras do autor, o que não fazer) e `PRODUCT.md` (público, restrições, princípios).
2. Referência visual: **AutoCAD e Revit**. O Traço nunca deve parecer painel web nem app genérico.
3. Onde `DESIGN.md` e o código divergirem, vale o código; corrija o documento ou o código, não deixe a divergência.

## Regras do autor (resumo; texto completo em `DESIGN.md`)
- Acento ciano num único token (`--ac`). Laranja `#d97757` (`--claude-orange`) só no painel do Claude.
- O nome "Traço" nunca fica ao lado do logo na barra nem na faixa (teste: `src/components/TitleBar.test.tsx`).
- Nenhuma cor nem marca da Lottos na interface; a Lottos só aparece como autora em Configurações › Sobre.
- Nenhuma animação pode atrasar pan, zoom, medição ou desenho. Manter `liveZoom`, `useLagClose`, `Presence`, `reducedMotion`.
- Cubo de vistas, eixos e seta de altura do 3D: propostas ainda não aprovadas; não implementar sem o autor.
- Função nova de interface só com confirmação do autor.

## Onde está cada coisa
- `src/index.css`: tokens R3 no topo, depois o CSS geral e, no fim, a camada de superfícies, cantos e vidro.
- `src/r3.css`: casca (barra de título, faixa, status), paletas, diálogos. Escopo `.rx`.
- `src/ribbon.ts` e `src/ribbonIcons.json`: grupos da faixa e ícone de cada comando. Ícones próprios em `src/assets/icones-*.svg` (componentes `Icon` e `Glyph`).
- `src/components/pal/*`: pilha de paletas. `Dlg.tsx`: diálogos. `TitleBar.tsx`, `Ribbon.tsx`, `StatusBar.tsx`: casca.
- `src/theme.ts`: paleta personalizada (OKLCH, contraste 4,5:1) e tema. `electron/main.cjs`: `TITLEBAR_H=30` (igual à barra de título do CSS).
- Textos: `src/i18n/pt.ts` mais en, es, fr, de, it, zh. Chave nova entra nos sete idiomas, sem chave órfã.
- `localStorage` (`traco.*`) mantém nome e formato.

## Verificação (rode antes de dizer que está pronto)
```bash
npx tsc -p tsconfig.app.json --noEmit   # o `tsc --noEmit` da raiz não checa nada
npx eslint src
npm test
npm run i18n:check
npm run build:desktop
npm run test:e2e                        # precisa do dist-desktop; 2 verificações de abas de documento já falhavam antes
```
Visual: `npm run dev` (porta 5174) nos temas escuro e claro, em 1600×1000 e 1280×720, e no celular (`MobileShell`). Hooks do Impeccable rodam a cada edição; alertas em `dist-desktop` vêm de build antigo.

## Fora do escopo por enquanto
3D chapado, 2 de 5 portas, rótulos colidindo, CSV "18,40", frase de privacidade do Claude (pilha B).
