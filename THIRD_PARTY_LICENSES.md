# Licenças de terceiros

O Traço usa as bibliotecas abertas abaixo (dependências diretas; as transitivas têm licenças permissivas equivalentes). Cada pacote traz o seu próprio texto de licença em `node_modules/<pacote>/`. Esta lista é gerada por `npm run licenses`.

Componentes que merecem destaque:

- **PDFium** (via `@embedpdf/pdfium`, WebAssembly): BSD-3-Clause / Apache-2.0 (texto em `LICENSE.pdfium` dentro do pacote). Faz a tarja definitiva no app de PC.
- **PDF.js** (`pdfjs-dist`): Apache-2.0. Abre e desenha os PDFs.
- **Tesseract.js**: Apache-2.0. OCR em 7 idiomas: português e inglês com os dados de `@tesseract.js-data/por` e `@tesseract.js-data/eng` (licença no próprio pacote); os demais são baixados sob demanda do serviço público do Tesseract.
- **three.js**: MIT. Modo 3D.
- **Electron**: MIT. App de PC.

| Pacote | Versão | Licença | Origem |
|---|---|---|---|
| @embedpdf/pdfium | 2.15.1 | MIT | https://github.com/embedpdf/embed-pdf-viewer |
| @eslint/js | 9.39.5 | MIT | https://github.com/eslint/eslint |
| @modelcontextprotocol/sdk | 1.32.1 | MIT | https://github.com/modelcontextprotocol/typescript-sdk |
| @tesseract.js-data/eng | 1.0.0 | MIT | https://github.com/naptha/tessdata |
| @tesseract.js-data/por | 1.0.0 | MIT | https://github.com/naptha/tessdata |
| @testing-library/dom | 10.4.2 | MIT | https://github.com/testing-library/dom-testing-library |
| @testing-library/react | 16.3.3 | MIT | https://github.com/testing-library/react-testing-library |
| @types/node | 22.20.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react-dom | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/three | 0.186.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @vitejs/plugin-react | 4.7.0 | MIT | https://github.com/vitejs/vite-plugin-react |
| electron | 33.4.11 | MIT | https://github.com/electron/electron |
| electron-builder | 26.15.3 | MIT | https://github.com/electron-userland/electron-builder |
| electron-updater | 6.8.9 | MIT | https://github.com/electron-userland/electron-builder |
| esbuild | 0.25.12 | MIT | https://github.com/evanw/esbuild |
| eslint | 9.39.5 | MIT | eslint/eslint |
| eslint-plugin-react-hooks | 5.2.0 | MIT | https://github.com/facebook/react |
| eslint-plugin-react-refresh | 0.4.26 | MIT | github:ArnaudBarre/eslint-plugin-react-refresh |
| fflate | 0.8.3 | MIT | https://github.com/101arrowz/fflate |
| globals | 16.5.0 | MIT | sindresorhus/globals |
| jsdom | 30.1.3 | MIT | https://github.com/jsdom/jsdom |
| lucide-react | 0.460.0 | ISC | https://github.com/lucide-icons/lucide |
| pdf-lib | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| pdfjs-dist | 4.10.38 | Apache-2.0 | https://github.com/mozilla/pdf.js |
| pe-library | 1.0.1 | MIT | https://github.com/jet2jet/pe-library-js |
| playwright-core | 1.64.1 | Apache-2.0 | https://github.com/microsoft/playwright |
| react | 19.3.0 | MIT | https://github.com/react/react |
| react-dom | 19.3.0 | MIT | https://github.com/react/react |
| resedit | 2.0.3 | MIT | https://github.com/jet2jet/resedit-js |
| tesseract.js | 7.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js |
| three | 0.186.1 | MIT | https://github.com/mrdoob/three.js |
| typescript | 5.8.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| typescript-eslint | 8.71.2 | MIT | https://github.com/typescript-eslint/typescript-eslint |
| vite | 6.4.4 | MIT | https://github.com/vitejs/vite |
| vite-plugin-singlefile | 2.3.3 | MIT | https://github.com/richardtallent/vite-plugin-singlefile |
| vitest | 5.0.5 | MIT | https://github.com/vitest-dev/vitest |
| xlsx | 0.18.5 | Apache-2.0 | https://github.com/SheetJS/sheetjs |
| zod | 3.25.76 | MIT | https://github.com/colinhacks/zod |
| zustand | 5.0.15 | MIT | https://github.com/pmndrs/zustand |
