---
name: Traço
description: Medição e revisão de pranchas em PDF, com a folha no centro e os instrumentos em volta, no jeito de programa de CAD.
colors:
  bg: "#1d1e20"
  rib: "#2d2e31"
  rib2: "#262729"
  pal: "#27282b"
  ph: "#35363a"
  ph-hi: "#47494e"
  cell: "#222325"
  in: "#1a1b1d"
  btn: "#323337"
  ln: "#131415"
  ln2: "#45474c"
  ln3: "#33353a"
  hi: "#464950"
  hi2: "#3b3d42"
  hi2-ln: "#6f727a"
  canvas: "#4b4d52"
  st: "#232426"
  menu: "#2f3033"
  ico: "#dfe1e5"
  text: "#e8e9eb"
  text-2: "#c4c7cc"
  text-3: "#a9adb4"
  tx-hi: "#ffffff"
  ac: "#6cc0dc"
  on-accent: "#0b1d24"
  ctx: "#b79cf5"
  danger-text: "#ff7b80"
  warn: "#ffb224"
  warn-text: "#ffcf70"
  warn-bg: "#3d3216"
  ok-text: "#3dd68c"
  claude-orange: "#d97757"
  claude-text: "#f0a58c"
  light-bg: "#a3a7ad"
  light-rib: "#cacdd1"
  light-pal: "#c4c8cc"
  light-canvas: "#71767d"
  light-text: "#0f1114"
  light-ac: "#075a73"
  light-ctx: "#4f2a9e"
typography:
  base:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', Inter, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.25
    fontFeature: "'tnum'"
  strong:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', Inter, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  value:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', Inter, system-ui, -apple-system, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    fontFeature: "'tnum'"
  mono:
    fontFamily: "'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "11.5px"
    fontWeight: 400
rounded:
  xs: "2px"
  sm: "2px"
  md: "2px"
  lg: "3px"
  pill: "999px"
spacing:
  "1": "1px"
  "3": "3px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
components:
  title-bar:
    backgroundColor: "{colors.bg}"
    height: "30px"
  ribbon-tabs:
    backgroundColor: "{colors.rib2}"
    height: "27px"
  ribbon:
    backgroundColor: "{colors.rib}"
    height: "96px"
  status-bar:
    backgroundColor: "{colors.st}"
    height: "24px"
  palette:
    backgroundColor: "{colors.pal}"
    width: "240px"
  palette-bar:
    backgroundColor: "{colors.ph}"
    height: "25px"
  button-big:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.xs}"
    height: "72px"
    width: "56px"
  button-big-active:
    backgroundColor: "{colors.hi}"
    textColor: "{colors.tx-hi}"
  button-small:
    textColor: "{colors.text}"
    rounded: "{rounded.xs}"
    height: "24px"
  toolbar-button:
    backgroundColor: "{colors.btn}"
    textColor: "{colors.text}"
    rounded: "{rounded.xs}"
    height: "22px"
  dialog-button:
    backgroundColor: "{colors.btn}"
    textColor: "{colors.text}"
    rounded: "{rounded.xs}"
    height: "26px"
  dialog-button-primary:
    backgroundColor: "{colors.btn}"
    textColor: "{colors.text}"
  field:
    backgroundColor: "{colors.in}"
    textColor: "{colors.text}"
    rounded: "{rounded.xs}"
    height: "22px"
    padding: "0 6px"
  dialog:
    backgroundColor: "{colors.pal}"
    rounded: "{rounded.lg}"
---

# Design System: Traço

> **Estado deste arquivo (2026-11-19).** Reescrito depois que o redesenho R3 (fases 0 a 4) foi para o código: os valores vêm de `src/index.css` (tokens R3 no topo e camada final de superfícies) e de `src/r3.css` (casca, paletas e diálogos). O contrato visual das maquetes está nas pastas de design do autor (`GUIA.md`, `base.css`, `GLOSSARIO.md`); onde este arquivo e o código divergirem, vale o código, e a divergência é um defeito a corrigir. As regras do autor (seção própria, abaixo) vencem qualquer trecho que as contradiga.

## Overview

**Creative North Star: "A Prancheta de CAD"**

A folha fica no centro, sobre a mesa cinza. Em volta, o que um desenhista de AutoCAD ou Revit espera encontrar: barra de título com acesso rápido, abas e faixa de opções com grupos, paletas empilhadas com árvore de projeto, barra de status com a instrução da ferramenta. Nada fica em cima do desenho. Tudo o que não é planta é mobiliário: cinza neutro, contornos de 1px, cantos de 2px, sem brilho.

O sistema é de trabalho. A densidade é alta (texto de 12px, botões de 22 a 26px, botão grande de 72px na faixa), porque a pessoa passa horas medindo num notebook de 14 a 15 polegadas com escala de 125 a 150 %. A cor aparece pouco e sempre com função: **ciano** (`--ac`) para o que está ativo, selecionado ou é a ação principal; roxo claro (`--ctx`) para a aba e o grupo contextuais; âmbar para o que falta (escala não definida); vermelho e verde para estado. O tema escuro é o padrão; o claro é um cinza médio de CAD (faixa e paletas entre 78 e 84 % de luminosidade, mesa mais escura que as paletas, a folha como único plano quase branco).

O movimento serve à interface em volta da planta e nunca à planta. Três durações (`--t-fast` 120 ms, `--t-med` 200 ms, `--t-slow` 280 ms) e uma curva de desaceleração (`--ease-out`). A saída é mais curta que a entrada, ação por atalho de teclado não anima e o valor medido troca na hora.

**Key Characteristics:**
- A folha é o único plano quase branco e o único com sombra de papel.
- Superfícies neutras em degraus próximos (`bg`, `rib2`, `rib`, `pal`, `ph`, `hi`), separadas por contorno de 1px e não por contraste forte.
- Um acento só (`--ac`, ciano), em um único token; mudar a cor é editar uma linha.
- Ícones próprios em sprite (`src/assets/icones-*.svg`), tinta `--ico`; cor de função só dentro do ícone.
- Números medidos em algarismos tabulares, sem animação.
- Cantos de 2px (3px no diálogo); sem sombra nas superfícies, só no que flutua.
- Vidro é opção (interruptor em Configurações › Aparência), desligado por padrão.

### Regras do autor

- **A referência visual do Traço é AutoCAD e Revit.** Toda tela ou conceito novo é comparado com eles antes de ser mostrado.
  Why: é a cara que o autor e o público reconhecem como programa profissional de engenharia.
  <!-- 2026-11-18: escolheu "AutoCAD / Revit" quando perguntado qual programa tem a cara que ele quer; confirmou o motivo -->
- **O Traço nunca deve parecer painel web nem app genérico.** Os sinais que fazem o autor reconhecer AutoCAD e Revit como programa profissional, e que servem de medida na comparação: faixa de opções com grupos, ícones técnicos próprios, e paletas com árvore de projeto. Uma composição de caixas, listas e barras que serviria a qualquer app é reprovada.
  Why: "tornar um app mais profissional".
  <!-- 2026-11-11: "ta com muita cara de um webapp", "muito generico" · 2026-11-14: "ainda parece muito um app de IA" · 2026-11-18: sobre três conceitos, "Continua genérico"; marcou faixa de opções com grupos, ícones técnicos próprios, paletas e árvore de projeto -->
- **Aparência e fluxo podem mudar por inteiro, desde que nenhuma função se perca.**
  Why: "mantendo a funcionalidade e praticidade".
  <!-- 2026-11-18: "Redesenho total, inclusive o fluxo". Substitui "refinar, não redesenhar" de 2026-11-14 -->
- **O acento é um token só (`--ac`), ciano.** O laranja do Claude (`--claude-orange`, #d97757) vale só no painel do Claude; o ícone das abas do Claude pode ficar laranja, o texto não.
  <!-- 2026-11-18: escolheu ciano; "Só o ícone laranja" para as abas Claude -->
- **O interruptor do vidro continua**, desligado por padrão, na aba Aparência.
  <!-- 2026-11-18: "Manter o interruptor" -->
- **Cubo de vistas, eixos e seta de altura do 3D são propostas ainda não aprovadas.** Não entram no código sem o autor aprovar cada uma.

## Colors

- **Regra do autor: a interface do Traço nunca usa as cores nem a marca da Lottos Engenharia (azul-marinho e dourado).** A Lottos aparece só como autora, em Configurações › Sobre.
  Why: cada app tem identidade própria.
  <!-- 2026-11-18: "Nenhum: Traço é independente"; confirmou o motivo. Vale para todos os apps do autor -->

Os apelidos antigos (`--panel`, `--panel-2`, `--raise`, `--line`, `--accent`…) apontam para os tokens R3; a paleta personalizada de `src/theme.ts` (OKLCH, contraste 4,5:1) continua escrevendo neles. Os valores abaixo são do tema escuro; o claro repete os papéis em `:root[data-theme='light']`.

### Primary
- **Ciano de Traço** (`--ac`, `#6cc0dc` no escuro e `#075a73` no claro): contorno e filete do que está ativo (aba da faixa, botão grande ativo, botão principal de diálogo), foco de teclado, caixa marcada. O texto sobre ele usa `--on-accent`. Mudar a cor: só `--acento-escuro` e `--acento-claro` no topo de `src/index.css`.
- **Véu de acento** (`--accent-soft`, 30 %): seleção de texto e fundo de itens marcados.

### Secondary
- **Contexto** (`--ctx`, `#b79cf5` no escuro, `#4f2a9e` no claro): aba e grupo contextuais, que aparecem com a ferramenta. Só para isso.
- **Laranja do Claude** (`--claude-orange`, `#d97757`; texto em `--cl-tx`): ícone das abas do Claude, faísca, botão de enviar e borda das sugestões no painel do Claude. Em nenhum outro lugar.

### Tertiary
- **Vermelho de Pendência** (`--danger`, texto em `--danger-text`): item aberto, erro, ação destrutiva.
- **Âmbar de Aviso** (`--warn`, texto `--warn-text`, fundo `--warn-bg`): escala não definida, alteração não salva, o aviso fixo de escala (`.al`).
- **Verde de Conferido** (`--ok`, texto `--ok-text`): item resolvido, confirmação.

### Neutral
- **Moldura** (`--bg`): barra de título e fundo atrás de tudo.
- **Faixa** (`--rib`) e **abas** (`--rib2`): corpo da faixa de opções e fileira de abas.
- **Paleta** (`--pal`), **barra de paleta** (`--ph`, filete `--ph-hi`), **célula** (`--cell`, também cabeçalho de tabela), **campo** (`--in`), **botão** (`--btn`).
- **Ativo** (`--hi`) e **realce fraco** (`--hi2`, contorno `--hi2-ln`): o que está selecionado ou ativo.
- **Mesa** (`--canvas`): onde a folha repousa. **Status** (`--st`). **Menu** (`--menu`): menu, dica, diálogo.
- **Contornos**: `--ln` (divisória forte), `--ln2` (controle), `--ln3` (linha de grade).
- **Texto**: `--text`, `--text-2`, `--text-3` (≥ 4,5:1 sobre as paletas; nunca sobre `--hi`), `--tx-hi` (número em destaque). **Tinta dos ícones**: `--ico`.

### Named Rules
**Regra do Estado como Texto.** Cor de estado escrita como texto usa sempre a variante `-text`. O token sem sufixo é só para preenchimento, ponto e borda.

**Regra do Laranja Reservado.** O laranja pertence ao Claude. Não marca seleção, aviso nem destaque em nenhum outro lugar.

**Regra do Acento Derivado.** Texto ou ícone colorido sobre painel usa `--accent-text`, nunca um hex escrito à mão. Quando a pessoa troca as cores, `src/theme.ts` recalcula `accent`, `on-accent`, `accent-text` e `accent-soft` e garante 4,5:1; cor escrita à mão no CSS fica fora dessa garantia.

**Em consolidação.** Ainda há cores literais fora de token: as do Comparar (`#ff3b3b`, `#1f6bff`, `#111`), o verde do selo de atualização e do conector (`#30a46c`), a mira do celular (`#ff2d55`), o azul `#4d8dff` do selo de edição do Claude e as cores de função dentro dos ícones do sprite.

## Typography

**Body Font:** Segoe UI Variable Text (com Segoe UI, Inter, system-ui)
**Mono Font:** Cascadia Code (com JetBrains Mono, ui-monospace), pela variável `--mono`.

**Character:** A fonte do sistema, pequena e firme, como em programa de CAD. A intenção é parecer parte do computador da pessoa e sair da frente do desenho.

### Hierarchy
- **Base** (400, 12px, altura 1,25, `tabular-nums`): toda a casca R3 (`.rx`): faixa, paletas, tabelas, diálogos. O corpo legado fora da casca (planta, Pranchas, Comparar, 3D) ainda usa 13px.
- **Strong** (600, 12px): nome de arquivo na barra de título, aba ativa, botão principal, título de diálogo, rótulo da ferramenta ativa.
- **Value** (650, 24px, `tabular-nums`): o valor medido no cartão de medição. É o maior texto da interface.
- **Nome de grupo e legenda** (400, 12px, `--text-3`): nome do grupo, embaixo da faixa; legendas.
- **Mono** (400, 11.5px, `--mono`): código, variáveis de fórmula, registro e campos marcados como `.mono`.

### Named Rules
**Regra do Número Sagrado.** Valor de medição, zoom, escala, número de página e coluna numérica usam `font-variant-numeric: tabular-nums` e trocam na hora, sem transição.

**Em consolidação.** A escala tipográfica não é token e o CSS legado tem vários tamanhos em px (10 a 24) e oito pesos. Os papéis acima são os que se repetem; os demais valores são variações a reduzir, não degraus a reutilizar.

## Layout

O app de PC é uma pilha vertical fixa, definida em `.rx-top` e `.app:not(.mobile)`: barra de título de **30px** (logo, acesso rápido, nome do arquivo no centro, busca, tema, configurações e os botões da janela de 44px), abas da faixa de **27px** (menu Arquivo, Início, Anotar, Pranchas, Comparar, 3D, Exibir, Claude, mais a aba contextual), faixa de opções de **96px** (grupos com botão grande de 72px e pilhas de até três botões de 24px, nome do grupo embaixo em 18px), a área de trabalho e a barra de status de **24px**. O valor de 30px da barra de título é o mesmo de `TITLEBAR_H` em `electron/main.cjs`; mudar um exige mudar o outro.

A área de trabalho tem a pilha de paletas à esquerda (240px de largura, barra de paleta de 25px com pega, fixar e fechar), a planta no meio e a pilha à direita (Propriedades). Abaixo da planta há a paleta inferior (Quantitativo, Marcações), com a altura que a pessoa ajustou (`traco.bottomH`). As paletas são encostadas, cada uma com um fio só do lado em que encontra a vizinha; `Resizer` ajusta as larguras. Quais paletas abrem depende da aba da faixa.

Espaçamento sem token; os valores que se repetem são 1, 3, 6, 8, 10 e 12px. Linhas de controle: 22px (campo, botão de barra), 24px (botão pequeno, aba), 26px (botão de diálogo).

Quebras por largura da janela: até 1280px (`App.tsx`) a janela conta como estreita e os painéis laterais recolhem ao cruzar o limite (a direita fecha abaixo de 1180px), e a pessoa pode reabri-los; a faixa recolhe grupos em botão aberto sob demanda; abaixo de 820px (ou até 500px de altura com ponteiro grosso) entra a casca de celular (`MobileShell`), com barra superior, abas inferiores e painéis em gaveta; alvos de toque de 44px no mínimo.

### Named Rules
**Regra da Planta que Manda.** A área da planta só muda de tamanho de uma vez. Painel abre e fecha com `transform` e opacidade enquanto a coluna da grade troca num único passo; nada anima largura de coluna.

**Regra da Mão no Teclado.** Ação disparada por atalho de teclado é imediata, sem transição de painel (`body.panels-instant`).

## Elevation & Depth

Plano. A profundidade vem do degrau de tom entre `bg`, `rib`, `pal`, `ph` e `hi`, com contorno de 1px. As superfícies não têm sombra (`--edge` é nulo). Só o que flutua tem sombra: menu, dica rica, diálogo, peças sobre a planta.

### Shadow Vocabulary
- **Papel** (`--sheet-shadow`, escuro: `0 2px 6px rgba(0,0,0,.4), 0 18px 50px rgba(0,0,0,.45)`): só a folha e a folha do Comparar.
- **Flutuante** (`--float-shadow`: `0 6px 20px rgba(0,0,0,.3)`; claro `.12`): peças sobre a planta, menu de contexto, dica, painéis do 3D.
- **Diálogo** (`--sombra`: `0 6px 18px rgba(0,0,0,.45)`), sobre véu `--veu` (`rgba(0,0,0,.45)`).
- **Ativo na faixa**: filete de 2px em `--ac` por dentro, no topo da aba e na base do botão de ícone ativo; nunca brilho.

### Vidro
Opcional. Com o interruptor ligado, painéis do app de PC e a barra e o painel do 3D ganham fundo `color-mix(in srgb, var(--panel) 72%, transparent)` e `backdrop-filter: blur(28px) saturate(1.3)`. Desliga com `data-glass='off'` (padrão) e com `prefers-reduced-transparency`. A casca de celular não usa vidro.

### Named Rules
**Regra do Vidro Fora da Planta.** Nada que flutua sobre a planta usa `backdrop-filter`. O fundo dessas peças muda a cada quadro de pan e zoom, e o desfoque seria recalculado junto.

**Regra da Sombra de Papel.** `--sheet-shadow` é da folha. Paleta, cartão e menu usam contorno, e só o que flutua usa `--float-shadow`.

## Shapes

Cantos de **2px** em tudo (`--r-xs`, `--r-sm`, `--r-md`), **3px** no diálogo (`--r-lg`), pílula (`--r-pill`) só nos chips de Snap/Orto e do 3D. As abas da faixa têm cantos superiores de 2px. A folha tem canto reto. Toda superfície tem contorno de 1px: `--ln2` em controles, `--ln` em divisórias fortes, `--ln3` em grade. Seleção em lista é fundo (`--hi`), não contorno grosso. O foco de teclado é contorno de 2px em `--ac`. O estado pressionado encolhe o controle (`scale: 0.97`; `0.94` em botão de ícone).

## Components

Controles baixos, com contorno fino, resposta em 120 ms e sem enfeite. O que está ativo é dito por fundo e filete, nunca por tamanho.

### Faixa de opções
- **Aba:** 24px de altura, 13px de respiro, texto `--text-2`. A ativa (25px) tem fundo `--rib`, peso 600 e filete de 2px em `--ac` por dentro, no topo. A contextual leva `--ctx` e vem com 10px de afastamento.
- **Grupo** (`.grp`): coluna com divisória à direita; os botões ficam em 74px e o nome do grupo em 18px. O grupo contextual é sempre o último, com filete em `--ctx`.
- **Botão grande** (`.bb`): 56px de largura mínima, 72px de altura, ícone de 32px sobre o rótulo, até duas linhas. **Uma ferramenta ativa por tela**: fundo `--hi`, contorno `--ac`, rótulo em `--tx-hi`.
- **Botão pequeno** (`.sb`): 24px, ícone de 16px e rótulo, atalho entre parênteses; em pilhas de até três. Opção escolhida: fundo `--hi2`.
- **Desabilitado:** 45 % de opacidade.

### Botões e campos
- **Botão de barra** (`.tbn`): 22px, ícone de 16px mais rótulo, fundo `--btn`, contorno `--ln2`.
- **Botão de ícone** (`.ib`): 24 por 22px, só para comandos de janela e de paleta; hover em cinza a 22 %. Ativo: fundo `--hi2` e filete de 2px em `--ac`.
- **Botão de diálogo** (`.btn`): 26px, 84px de largura mínima. **Principal:** contorno de 2px em `--ac` (contornado, não preenchido) e peso 600.
- **Campo** (`.in`): 22px, fundo `--in`, contorno `--ln2`, respiro de 6px; valor em `--text`, dica em `--text-3`. Foco: contorno em `--ac`. Erro: contorno em `--danger-text`.
- **Lista suspensa** (`.cb`) e **caixa de marcar** (`.ck`, 13px, visto em `--text`).

### Paletas e Navegador
- **Barra de paleta** (`.ph`): 25px, fundo `--ph`, filete claro `--ph-hi` no topo, título em 600, contador em `--text-3` ("Marcadores 10"), pega, fixar e fechar.
- **Árvore do projeto** (`.tree`): folhas com estado de escala, áreas e marcações como filhos; selecionado em `--hi`. Menu de contexto na árvore e na biblioteca.
- **Propriedades:** anatomia única: seletor, resumo com o valor uma vez, barra Duplicar/Excluir, seções e estados "sem seleção" e "em curso".

### Diálogos e avisos
- **Diálogo** (`.dlg`, em `Dlg.tsx`): fundo `--pal`, contorno `--hi2-ln`, canto de 3px; barra de título de 30px (`--ph`, 600), corpo com 12px de respiro, rodapé de 26px de botões sobre `--cell`. Abas de diálogo (`.dtabs`) com filete em `--ac`. Entra em `--t-med`, sai com fade de `--t-fast`.
- **Aviso de escala** (`.al`): faixa fixa de 30px, fundo `--warn-bg`, contorno e texto em âmbar. É o aviso permanente de que a medição ainda não vale.
- **Avisos transitórios:** `store.notify(msg, 'err')`; nunca bloqueiam a planta.

### Barra de status
24px, fundo `--st`. À esquerda a instrução da ferramenta (`toolInfo.ts`), no meio as células (escala, zoom, Snap, Orto), à direita o que muda com o modo.

### Movimento da interface
- **Dicas:** a dica simples espera 350 ms na primeira; depois que uma abriu, as vizinhas abrem na hora.
- **Troca de modo e de tema:** View Transitions só aí (`motion.ts`). Só a área central se move (280 ms).
- **Aba deslizante** (`.tab-pill`) e **presença** (`.presence`, saída em `--t-fast`).
- **Menos movimento:** `prefers-reduced-motion` desliga tudo, menos o giro de "processando" e os pontos de "digitando".
- **Em revisão:** `--ease-spring` existe e hoje só aparece na pílula dos modos, no balão do controle deslizante e nas amostras de cor. Uso restrito, não padrão.

## Do's and Don'ts

### Do:
- **Faça** a folha ser a única superfície quase branca e a única com `--sheet-shadow`.
- **Faça** cor sobre painel pelos tokens (`--ac`, `--accent-text`, `--danger-text`, `--warn-text`, `--ok-text`).
- **Faça** todo número que muda (medida, zoom, escala, página) com `tabular-nums` e troca imediata.
- **Faça** transições listando as propriedades e usando `--t-fast`, `--t-med` ou `--t-slow` com `--ease-out`; a saída mais curta que a entrada.
- **Faça** painéis entrarem e saírem com `transform` e opacidade, com a coluna da grade trocando de uma vez.
- **Faça** raios novos com `--r-xs`, `--r-sm`, `--r-md`, `--r-lg` ou `--r-pill`.
- **Faça** ícones novos no sprite próprio (`Icon`/`Glyph`) e o mapa comando→ícone em `src/ribbonIcons.json`; todo controle tem texto legível.
- **Faça** o foco de teclado visível (contorno de 2px em `--ac`).
- **Faça** chave nova de texto nos sete idiomas (`npm run i18n:check`).

### Don't:
- **Regra do autor: não escreva o nome "Traço" ao lado do logo na barra nem na faixa.** A barra mostra só o logo. O nome aparece em frases de diálogo e em Configurações › Sobre, e uma vez por janela (título do sistema). Verificado por `src/components/TitleBar.test.tsx`.
  Why: nome ao lado do logo deixa o app genérico.
  <!-- 2026-11-11: "muito generico [...] com o nome ao lado do logo exatamente como o Traço está" · 2026-11-14: "o nome praticamente duplicado". Vale para todos os apps do autor -->
- **Não** coloque nada fixo em cima da planta além das peças flutuantes que já existem.
- **Não** use `backdrop-filter` em peça que flutua sobre a planta.
- **Não** anime pan, zoom, medição ou desenho, nem atrase essas ações com transição da interface.
- **Não** anime a grade nem a largura de coluna de painel.
- **Não** anime ação disparada por atalho de teclado.
- **Não** escreva `transition: all` nem duração em número solto.
- **Não** use `danger`, `warn` ou `ok` sem sufixo como cor de texto.
- **Não** use o laranja `#d97757` fora do painel e das entradas do Claude.
- **Não** use brilho colorido, gradiente de texto, cartões iguais de ícone mais título como estrutura, nem emoji no lugar de ícone.
- **Não** trate `--ease-spring` como curva padrão.
- **Não** crie mais um tamanho de fonte, peso, raio literal ou cor hex fora de token.
- **Não** crie mais um desenho para "selecionado": é `--hi` com contorno ou filete em `--ac`.
- **Não** quebre o celular: a casca `MobileShell` e `useIsMobile` seguem valendo.
