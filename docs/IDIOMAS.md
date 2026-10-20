# Idiomas do Traço

O Traço fala **português, inglês, espanhol, francês, alemão, italiano e chinês (simplificado)**. Ele abre no idioma do sistema (e em inglês se o idioma não for um desses) e a pessoa troca quando quiser em **Configurações › Sobre › Idioma · Language**.

## Tradução de sentido, não literal

Uma tradução palavra por palavra de um app de obra fica estranha. Por isso os nomes das ferramentas e os termos técnicos seguem **o que a área usa em cada língua**, e as descrições foram reescritas para explicar a ferramenta, não só traduzir a frase. Alguns exemplos:

| Em português | Inglês | Espanhol | Francês | Alemão | Italiano | Chinês |
|---|---|---|---|---|---|---|
| prancha / folha | sheet | plano / hoja | planche | Blatt | tavola | 图纸 |
| carimbo (da prancha) | title block | cajetín | cartouche | Schriftfeld | cartiglio | 图签 |
| carimbo (ferramenta) | stamp | sello | tampon | Stempel | timbro | 图章 |
| quantitativo | takeoff | mediciones | métré | Mengenermittlung (Mengen) | computo metrico | 工程量 |
| marcador (serviço com fator e fórmula) | item | partida | ouvrage | Position | voce | 分项 |
| marcação (desenho sobre a planta) | markup | marca | annotation | Markierung | annotazione | 标记 |
| ambiente | room | habitación | pièce | Raum | locale | 房间 |
| pavimento | level | nivel | niveau | Geschoss | piano | 楼层 |
| vazio (fosso, shaft, pilar) | void | hueco | trémie | Aussparung | vuoto | 洞口 |
| tarja | redaction | tachado | caviardage | Schwärzen | oscuramento | 涂黑 |
| nuvem de revisão | revision cloud | nube de revisión | nuage de révision | Revisionswolke | nuvola di revisione | 修订云线 |
| compatibilização | coordination | coordinación | synthèse | Koordination | coordinamento | 专业协调 |
| disciplinas (estrutura, instalações…) | disciplines | especialidades | lots | Fachplanungen | discipline | 专业 |
| calibrar por cota | calibrate on a known dimension | calibrar con una cota conocida | calibrer sur une cote connue | an bekannter Maßangabe kalibrieren | calibra su una quota nota | 按已知尺寸校准 |
| pé-direito | ceiling height | altura libre | hauteur sous plafond | lichte Raumhöhe | altezza interna | 净高 |
| BDI | markup (BDI) | indirectos y utilidad (BDI) | frais généraux et bénéfice (BDI) | Zuschläge (BDI) | spese generali e utile (BDI) | 管理费利润 (BDI) |

Coisas que valem em todas as línguas:

- **"Traço"** é o nome do produto e não se traduz.
- **Atalhos** (Ctrl+O, F3, Shift…) ficam como estão; só o nome da tecla muda quando o teclado muda (Strg, Maj, Mayús, Umschalt…).
- **Letras das fórmulas** (L, A, P, N, H, Q, V, VOL, AL, ALT) são iguais em todos os idiomas, para a fórmula de um marcador funcionar em qualquer computador.
- **Variáveis de carimbo** mudam de nome por idioma (`{data}`, `{date}`, `{fecha}`, `{datum}`…), mas o carimbo entende as de todos, então um projeto continua válido se a interface mudar de idioma.
- **Dados da pessoa não são traduzidos**: nomes de marcadores que ela criou ou editou, nomes de status, textos de marcações. Os marcadores e o autor **padrão** acompanham o idioma enquanto ela não os tiver alterado.
- **Texto desenhado dentro de PDFs** (legenda de quantitativo, relatório de compatibilização, rótulos de medida) usa a fonte padrão do PDF, que cobre as línguas latinas mas não ideogramas: em **chinês esse texto sai em inglês**. Os outros textos do app são todos em chinês.

## Como corrigir ou melhorar uma tradução

1. Abra `src/i18n/<idioma>.ts` (`en`, `es`, `fr`, `de`, `it` ou `zh`).
2. Ache a chave (use a busca) e mude o texto. **Mantenha as `{variáveis}` e as marcas `<b>…</b>`, `<kbd>…</kbd>`, `<code>…</code>` como estão**: os testes avisam se faltar alguma.
3. Rode `npm test`. Se quiser ver na tela, `npm run dev` e troque o idioma em Configurações › Sobre.

A fonte de todos os textos é `src/i18n/pt.ts` (português). Cada chave é `tela.assunto` (ex.: `toolinfo.tarja_corrigir_texto`).

## Como adicionar um idioma

1. Em `src/i18n/index.ts`, acrescente o idioma em `Lang`, em `LANGS` (nome na própria língua e *locale*) e em `loaders`.
2. Copie `src/i18n/en.ts` para `src/i18n/<novo>.ts` e traduza (o TypeScript não compila se faltar alguma chave).
3. Escolha as variáveis de carimbo do idioma (`dialogs.stamp_tokens`). Se forem palavras novas, acrescente-as a `STAMP_VARS` em `src/geometry.ts` e à lista de `src/i18n/i18n.test.ts`.
4. Se o idioma precisa de uma planta de exemplo própria, acrescente-o a `LABELS` em `scripts/make-sample-plans.mjs` e rode `npm run i18n:amostras`. Se a escala vem escrita de outro jeito no carimbo (como "SCALE 1:50" ou "比例 1:50"), acrescente a palavra em `scalesIn` (`src/pdf.ts`).
5. Rode `npm test` e `npm run i18n:check`.

## Ferramentas

- `npm run i18n:check` procura texto em português que ficou fixo no código (fora de `t('chave')`). Use ao criar telas novas.
- `npm test` confere que todos os idiomas têm as mesmas chaves e as mesmas variáveis, que cada `t('chave', {…})` do código passa as variáveis certas, e que não sobrou chave sem uso.
- `npm run i18n:amostras` refaz as plantas de exemplo (`public/exemplo/planta-exemplo*.pdf`).
