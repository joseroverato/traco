# Como contribuir com o Traço

Obrigado por querer ajudar. Qualquer contribuição vale: reportar um erro, sugerir uma função, melhorar um texto ou enviar código.

## Reportar um erro ou sugerir uma melhoria
Abra uma [issue](https://github.com/joseroverato/traco/issues) e conte:
- o que você tentava fazer e o que aconteceu;
- a versão do Traço (Configurações › Sobre) e se é o app de PC ou a versão web;
- se possível, um PDF de exemplo **sem dados confidenciais** (ou um print).

Para ideias, explique o problema que você quer resolver no dia a dia; isso ajuda mais do que descrever a solução.

## Rodar o projeto
Requer Node.js 22 ou superior.

    npm install
    npm run dev        # http://localhost:5173
    npm test           # testes (Vitest)
    npm run lint
    npx tsc -b         # conferência de tipos

## Traduzir ou corrigir um idioma
O Traço fala sete idiomas e as traduções são de sentido, não literais. Corrigir um texto é a forma mais fácil de começar: veja [docs/IDIOMAS.md](docs/IDIOMAS.md) (glossário, como editar `src/i18n/<idioma>.ts` e como acrescentar um idioma). Ao criar uma tela nova, ponha os textos em `src/i18n/pt.ts` e use `t('chave')`; `npm run i18n:check` aponta texto que ficou fixo.

## Enviar uma mudança
1. Faça um fork e crie uma branch.
2. Mantenha as mudanças pequenas e focadas; siga o estilo do código ao redor.
3. Cálculos (medidas, fórmulas, quantitativo, 3D) devem ter teste. As regras puras ficam em `src/` (por exemplo `geometry.ts`, `summary.ts`, `solids.ts`) e são fáceis de testar.
4. Rode `npx tsc -b`, `npm run lint`, `npm test` e `npm run i18n:check` antes de abrir o pull request.
5. Descreva no pull request o que muda e como você testou.

## Licença
Ao contribuir, você concorda que o seu código seja distribuído sob a [licença MIT](LICENSE) do projeto.
