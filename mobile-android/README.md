# Traço para Android

Empacota a versão web do Traço num app Android (Capacitor). O APK leva o site dentro dele: abre sem internet, e só precisa dela para o painel do Claude.

## Gerar o APK

Requisitos: Node 22+, JDK 17 e Android SDK (`ANDROID_HOME`) com `platforms;android-34` e `build-tools;34.0.0`.

```bash
cd mobile-android
npm install      # só na primeira vez
npm run apk      # gera out/Traco-<versão>-debug.apk
```

O número da versão vem do `package.json` da raiz (`versionName`) e vira `versionCode` = maior×10000 + menor×100 + correção.

## Instalar no celular

- **Pelo cabo:** ative a depuração USB no celular e rode `adb install -r out/Traco-<versão>-debug.apk`.
- **Sem cabo:** copie o `.apk` para o celular (Drive, e-mail, cabo), abra pelo app Arquivos e permita "instalar apps desconhecidos" para esse app quando o Android pedir.

O APK de teste é assinado com a chave de depuração do Android. Para a Play Store é preciso um **AAB** assinado com chave própria (veja o fim deste arquivo).

## O que é diferente do site

- Salvar e exportar abrem o menu **Compartilhar** do Android (salvar no Drive ou em Arquivos, enviar por WhatsApp ou e-mail), porque o WebView do Android não baixa arquivos por link.
- O service worker do PWA não é usado: os arquivos já estão no app.
- Ícone, tema escuro e tela de abertura próprios.

## Para a Play Store (próximos passos)

1. Gerar um **AAB** (`gradlew bundleRelease`) assinado com uma chave de envio própria (`keytool -genkey ...`), guardada fora do repositório.
2. Conta de desenvolvedor no Google Play Console (taxa única), ficha da loja, política de privacidade e formulário de segurança dos dados.
3. Teste fechado e depois produção.
