# Assinatura de código (SignPath Foundation)

Objetivo: assinar o instalador do Windows de graça, para reduzir o aviso do SmartScreen. A assinatura sozinha não zera o aviso: o Windows também considera quantas pessoas já baixaram e usaram o programa.

## O que o SignPath exige (resumo de signpath.org/terms)
- Licença de código aberto aprovada pela OSI, sem código proprietário. **O Traço é MIT.**
- Projeto ativo, **já lançado** na forma que será assinada, e com a função descrita na página de download. **Há releases e README.**
- Binários vindos de **build automatizado** do próprio repositório. **O fluxo `release.yml` (GitHub Actions) faz isso.**
- Nome do produto e versão consistentes nos binários assinados.
- **Aprovação manual a cada versão**, equipe de assinatura = equipe de desenvolvimento, **autenticação em dois fatores** no GitHub e no SignPath.
- Papéis definidos (autor, revisor, aprovador), política de assinatura e de privacidade publicadas. **Estão no README (seção "Política de assinatura de código").**
- Desinstalador e transparência sobre mudanças no sistema. **O instalador NSIS tem desinstalador.**

## O que só você pode fazer
1. Ativar a autenticação em dois fatores na conta do GitHub (`joseroverato`), se ainda não estiver.
2. Pedir a inscrição em **https://signpath.org/apply** (formulário em inglês) com a sua conta. Texto sugerido abaixo.
3. Confirmar que a **Lottos Engenharia autoriza** a publicação do código (a licença MIT está em nome da empresa).
4. Aguardar a resposta. A aceitação é decisão do SignPath e pode pedir mais informações.

## Texto sugerido para o formulário

> **Project name:** Traço
> **Repository:** https://github.com/joseroverato/traco
> **License:** MIT (OSI-approved), no dual licensing, no proprietary components.
> **Description:** Traço is a free, open-source Windows desktop app (Electron) and web app for civil and architectural engineers. It opens construction drawings in PDF, lets users measure length, area and counts on top of the drawing, builds the bill of quantities (Excel export), and shows measured solids in 3D. It runs entirely on the user's computer; PDFs are not uploaded anywhere.
> **Download page:** https://github.com/joseroverato/traco/releases/latest
> **Build process:** GitHub Actions workflow `.github/workflows/release.yml` builds the NSIS installer from the public repository on every version bump. We will add the SignPath GitHub Action to that workflow so only installers built there are signed, with manual approval for each release.
> **Team:** single maintainer (José Roverato, GitHub @joseroverato), acting as author, reviewer and approver, with two-factor authentication on GitHub and SignPath.
> **Privacy:** the app does not collect or send data. Its only network connections are the update check against GitHub Releases and, only if the user enables it, requests to the Anthropic API with the user's own key.
> **Why signing:** the installer currently triggers the Windows SmartScreen warning for every new user.

## Depois da aprovação (eu faço)
- Integrar a ação do SignPath ao `release.yml`: o instalador é enviado ao SignPath, aprovado por você e só então publicado na Release.
- Incluir no README e na página de download a frase de atribuição exigida pelo SignPath.
- Conferir que o `latest.yml` (usado pela atualização automática) continua com o hash do instalador **assinado**.
