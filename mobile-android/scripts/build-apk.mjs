// Gera o APK do Traço: compila a versão web, copia para o projeto Android (Capacitor) e compila com o Gradle.
// Uso (na pasta mobile-android): npm run apk          → out/Traco-<versão>-debug.apk (instala direto no celular)
// Requisitos: Node, JDK 17 e Android SDK (ANDROID_HOME) com platform 34 e build-tools 34.
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = path.resolve(here, '..')
const root = path.resolve(app, '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const [maj, min, pat] = pkg.version.split('.').map(Number)
const versionCode = maj * 10000 + min * 100 + pat

// No Windows, o Java 17 falha ("Unable to establish loopback connection") quando a pasta temporária tem acento,
// e o Gradle guarda o cache na pasta do usuário. Com acento no caminho (ex.: usuário "José"), usa pastas sem acento só para o build.
const hasNonAscii = (v) => [...(v ?? '')].some((c) => c.charCodeAt(0) > 127)
const env = { ...process.env }
if (process.platform === 'win32' && (hasNonAscii(os.tmpdir()) || hasNonAscii(os.homedir()))) {
  const base = path.join(process.env.SystemDrive ?? 'C:', path.sep, 'traco-build-tmp')
  const tmp = path.join(base, 'tmp')
  mkdirSync(tmp, { recursive: true })
  env.TEMP = env.TMP = tmp
  env.GRADLE_USER_HOME = path.join(base, 'gradle-home')
  env.JAVA_TOOL_OPTIONS = `-Djava.io.tmpdir=${tmp.split(path.sep).join('/')} -Djava.net.preferIPv4Stack=true`
}
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', env })

console.log(`\n== Traço ${pkg.version} (versionCode ${versionCode}) ==`)

console.log('\n[1/5] Versão web')
run('npm run build:web', root)

console.log('\n[2/5] Copiando para o projeto Android')
rmSync(path.join(app, 'www'), { recursive: true, force: true })
cpSync(path.join(root, 'dist'), path.join(app, 'www'), { recursive: true })

console.log('\n[3/5] Sincronizando o Capacitor')
run('npx cap sync android', app)

console.log('\n[4/5] Versão do app no Gradle')
const gradleFile = path.join(app, 'android', 'app', 'build.gradle')
let g = readFileSync(gradleFile, 'utf8')
g = g.replace(/versionCode \d+/, `versionCode ${versionCode}`).replace(/versionName "[^"]*"/, `versionName "${pkg.version}"`)
writeFileSync(gradleFile, g)

console.log('\n[5/5] Compilando o APK (o primeiro build baixa o Gradle e as bibliotecas: pode levar alguns minutos)')
const androidDir = path.join(app, 'android')
const gradlew = process.platform === 'win32' ? `"${path.join(androidDir, 'gradlew.bat')}"` : './gradlew'
run(`${gradlew} assembleDebug --no-daemon`, androidDir)

const built = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
if (!existsSync(built)) throw new Error('APK não encontrado: ' + built)
mkdirSync(path.join(app, 'out'), { recursive: true })
const dest = path.join(app, 'out', `Traco-${pkg.version}-debug.apk`)
cpSync(built, dest)
console.log(`\nAPK pronto: ${dest}`)
