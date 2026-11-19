# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Público amplo de obra (confirmado pelo autor em 2026-11-14): engenheiros e projetistas, mas também orçamentistas, mestres, compradores e estudantes, com menos familiaridade com software técnico. A interface precisa se explicar: nomes claros, dicas com demonstração, passo a passo no primeiro uso.

Situação típica: no escritório, em notebook comum (vídeo integrado, tela de 14 a 15 polegadas, escala de 125 a 150 %), por períodos longos, levantando quantitativo e revisando pranchas em PDF. Há também uma casca para celular (conferência rápida).

Observação: o README diz "feito por engenheiro, para engenheiros". O autor escolheu o público amplo como prioridade do design; o texto do README não foi alterado.

## Product Purpose

Abrir a prancha em PDF e medir em cima dela (comprimento, área, contagem, vazios), com escala por folha ou por região. O quantitativo se monta sozinho, com fórmulas, ambientes e pavimentos, e sai em Excel. Também revisa e compatibiliza (nuvens, itens numerados, comparação de revisões), organiza pranchas e mostra em 3D o que foi medido.

Sucesso: a pessoa mede e confia no número, sem a interface atrapalhar o desenho.

## Positioning

Gratuito, de código aberto (MIT), roda tudo no computador da pessoa (os PDFs não são enviados), em sete idiomas, com quantitativo ligado diretamente à medição e à base SINAPI.

## Operating Context

- Modos: Revisar, Pranchas, Comparar, 3D.
- App de PC (Electron, Windows) e versão web com a mesma interface; app Android (Capacitor).
- Entrada: PDF de prancha ou projeto `.traco`. Saída: Excel, PDF com marcações, relatório de compatibilização.
- Uso intenso de teclado (atalhos de uma letra para as ferramentas) e de mouse (roda = zoom no cursor).

## Capabilities and Constraints

- O desenho e a medição sobre a planta são o produto. Nenhuma animação pode atrasar pan, zoom, medição ou desenho no canvas. Movimento só na interface ao redor (painéis, menus, abas, diálogos, estados).
- Precisa ser fluido no notebook comum de escritório; efeitos pesados (vidro/desfoque) precisam de alternativa leve. Já existe o interruptor de vidro em Configurações › Aparência e no instalador.
- Stack: React 19, TypeScript, Vite, Zustand, CSS puro em `src/index.css` (tokens e superfícies) e `src/r3.css` (casca, paletas, diálogos), ícones próprios em sprite (`src/assets/icones-*.svg`, componente `Icon`), three.js no 3D, pdf.js/PDFium.
- Cores personalizáveis pelo usuário (cor principal e de acento), com contraste mínimo 4,5:1 calculado em OKLCH (`src/theme.ts`).
- Sete idiomas: rótulos variam muito de comprimento (alemão é o mais longo).
- Janelas pequenas são caso real (media queries em 1320, 1180 e 980 px).

## Brand Commitments

- Nome: Traço. Autor: Lottos Engenharia.
- Aparência e fluxo podem ser redesenhados por inteiro, desde que nenhuma função se perca (decisão do autor, 2026-11-18; substitui "refinar, não redesenhar" de 2026-11-14).
- Referência visual: AutoCAD e Revit. O app não deve parecer painel web nem usar a marca Lottos na interface (ver `DESIGN.md`, regras do autor).
- Tema escuro e claro (cinza de CAD); acento ciano num único token (`--ac`); laranja (#d97757) reservado ao painel do Claude.
- O nome "Traço" não aparece ao lado do logo na barra nem na faixa; só em frases de diálogo e em Configurações › Sobre (decisão do autor, 2026-11-18).
- Estrutura: barra de título, abas e faixa de opções com grupos, paletas empilhadas com árvore do projeto, barra de status (redesenho R3, em código desde 2026-11-19).
- Voz: português direto, termos de obra; tradução de sentido, não literal (`docs/IDIOMAS.md`).

## Evidence on Hand

- `docs/demo.gif`, capturas em `docs/divulgacao/`, notas de versão em `docs/notas/`.
- Planta de exemplo em `public/exemplo/` e `e2e/fixtures/planta-exemplo.pdf`.
- Sem depoimentos, números de uso ou casos de cliente: não inventar.

## Product Principles

1. A planta manda: a interface cede espaço e nunca atrasa o canvas.
2. O número é sagrado: valor de medição aparece na hora, estável (algarismos tabulares), sem efeito que gere dúvida.
3. Explica-se sozinho: quem nunca usou software técnico consegue medir seguindo dicas e passo a passo.
4. Leve por padrão no notebook comum; efeito é opção, não requisito.
5. Tudo local: privacidade faz parte do produto.

## Accessibility & Inclusion

- Contraste mínimo 4,5:1 para texto (já é regra no cálculo de cores).
- Respeitar `prefers-reduced-motion` e `prefers-reduced-transparency` (já existem no CSS).
- Padrão formal (WCAG 2.1 AA completo) ainda não foi decidido como requisito.
