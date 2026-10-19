# Traço — revisão e quantitativo de pranchas (nome provisório)

App próprio da Lottos para marcar, revisar e levantar quantitativos em pranchas PDF.
Versão web e app de PC usam o mesmo código (React + TypeScript + PDF.js).

## Rodar em desenvolvimento
Requer Node.js 22 ou superior.

    npm install
    npm run dev        # abre em http://localhost:5173

## Gerar builds
    npm run build:web        # dist/ — versão web leve (servidor; ver deploy/ para Docker)
    npm run build:preview    # dist-single/index.html — prévia em arquivo único
    npm run desktop          # roda o app de PC (Electron) em desenvolvimento
    npm run dist:win         # release/ — app de PC para Windows (.zip; no Windows: dist:win-installer gera instalador)

## Arquitetura
- src/ — interface (React + TypeScript), igual para web e PC
- src/commands.ts + src/tools.json — ferramentas do Claude (painel e MCP usam as mesmas)
- src/ai.ts — conversa com a API da Anthropic (tool use, imagens das folhas)
- electron/main.cjs — app de PC: arquivos nativos, chave criptografada, ponte local p/ MCP
- electron/engine.mjs — motor completo: MuPDF (tarja definitiva, otimização) + Tesseract (OCR pt)
- electron/mcp-server.mjs — servidor MCP (stdio) para o Claude Desktop; abre o Traço se estiver fechado
- deploy/ — Dockerfile + nginx + compose da versão web e scripts de instalação do PC

## Modos
- **Revisar**: marcações, medições, carimbos, imagens, viewports, quantitativo
- **Pranchas**: reordenar (arrastar), girar, duplicar, excluir, folha em branco, inserir PDF,
  extrair, dividir (.zip), renomear por padrão ou detectando o número no carimbo
- **Comparar**: sobrepõe duas revisões (vermelho = removido, azul = acrescentado),
  detecta as regiões alteradas e cria nuvens automaticamente na revisão nova

## Exportar PDF (Ctrl+E)
Grava marcações/carimbos/imagens no PDF, cria índice de folhas (marcadores), rótulos de página
com o nome da folha, metadados, e pode remover anotações que vieram no original.

## Fórmulas nos marcadores
Variáveis: L comprimento · A área · P perímetro · N contagem · H fator. Ex.: `A + P*H` (pintura de
paredes + teto a partir de uma área), `P` (rodapé), `L * 1,10` (perda de 10%), `ceil(N/10)`.

## Atalhos
V selecionar · H mover vista (ou segurar Espaço / botão do meio) · C nuvem · R retângulo · E elipse
A seta · I linha · T texto · B carimbo · P imagem · L comprimento · K área · N contagem
X viewport (escala própria) · S calibrar escala
Roda do mouse = zoom no cursor · 0 folha inteira · W largura · PageUp/PageDown troca de folha
Enter / duplo clique finaliza medição · Backspace desfaz vértice · Shift trava ângulo
Ctrl+Z/Y desfazer/refazer · Ctrl+S salvar projeto (.traco) · Del exclui

## Estrutura
src/components  Viewer (render + desenho), painéis, barra
src/geometry.ts cálculos (comprimento, área, escala)
src/summary.ts  quantitativo e exportação Excel
src/project.ts  salvar/abrir projeto .traco (PDF + marcações em um arquivo)

## Roadmap
- [x] Fase 1: layout, visualizador, marcações, escala, quantitativo, Excel, projeto
- [x] Fase 2: viewports, status personalizáveis, fórmulas, gestão de pranchas, edição/exportação de PDF,
      carimbos em lote, comparação de revisões
- [x] Fase 3: integração com Claude (painel com API + servidor MCP para o Claude Desktop)
- [x] Fase 4: app de PC (Electron, motor completo) e versão web leve com Docker

## Publicar uma versão nova (atualização automática)

O código fica no repositório privado `joseroverato/traco`. Para lançar:

1. Suba o número em `package.json` (ex.: `1.2.1`) e, se quiser, escreva `docs/notas/v1.2.1.md`.
2. `git commit -am "1.2.1" && git tag v1.2.1 && git push --follow-tags`
3. O GitHub Actions (`.github/workflows/release.yml`) gera `Traco-Setup-1.2.1.exe`, `latest.yml` e `Traco-Web-1.2.1.zip` e cria a Release.

Em cada PC, uma vez: Traço › Configurações (engrenagem) › Atualizações › colar um token *fine-grained* do GitHub com acesso só a este repositório e **Contents: Read-only**. O token fica criptografado no PC (Windows DPAPI). Depois disso o Traço verifica ao abrir, baixa e instala com um clique.
