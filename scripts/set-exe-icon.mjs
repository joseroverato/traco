// Aplica ícone e informações de versão ao Traco.exe sem precisar do Wine (resedit é JS puro).
import fs from 'node:fs'
import * as ResEdit from 'resedit'
import * as PELibrary from 'pe-library'

const exePath = process.argv[2] ?? 'release/win-unpacked/Traco.exe'
const icoPath = process.argv[3] ?? 'electron/icon.ico'
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version

const exe = PELibrary.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true })
const res = PELibrary.NtExecutableResource.from(exe)
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
const lang = groups[0]?.lang ?? 1033
const gid = groups[0]?.id ?? 1
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, ico.icons.map((i) => i.data))

const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] ?? ResEdit.Resource.VersionInfo.createEmpty()
const [a, b, c] = version.split('.').map(Number)
vi.setFileVersion(a, b, c, 0, lang)
vi.setProductVersion(a, b, c, 0, lang)
vi.setStringValues({ lang, codepage: 1200 }, {
  FileDescription: 'Traço — revisão de pranchas e quantitativos',
  ProductName: 'Traço',
  CompanyName: 'Lottos Engenharia',
  LegalCopyright: 'Lottos Engenharia',
  OriginalFilename: 'Traco.exe',
  InternalName: 'Traco',
  FileVersion: version,
  ProductVersion: version,
})
vi.outputToResourceEntries(res.entries)
res.outputResource(exe)
fs.writeFileSync(exePath, Buffer.from(exe.generate()))
console.log('ícone e versão aplicados em', exePath)
