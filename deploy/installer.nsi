; Instalador do Traço (NSIS) — instala por usuário, sem pedir administrador
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define APPNAME "Traço"
!define EXE "Traco.exe"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Traco"

Name "${APPNAME}"
OutFile "..\release\Traco-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Traco"
InstallDirRegKey HKCU "Software\Traco" "InstallDir"
RequestExecutionLevel user
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText " "
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Traço"
VIAddVersionKey "CompanyName" "Lottos Engenharia"
VIAddVersionKey "FileDescription" "Instalador do Traço"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Lottos Engenharia"

!include "ui.nsh"

Function .onInit
  Call UiInit
FunctionEnd

; o app de PC lê HKCU\Software\Traco\Glass ao abrir: 0 = painéis opacos (a pessoa ainda pode mudar nas configurações)
Function GlassOff
  WriteRegDWORD HKCU "Software\Traco" "Glass" 0
FunctionEnd

Section "Traço" SecMain
  SectionIn RO
  ; fecha o Traço se estiver aberto (atualização)
  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Sleep 500
  RMDir /r "$INSTDIR\resources"
  SetOutPath "$INSTDIR"
  File /r "..\release\win-unpacked\*.*"
  File "/oname=traco.ico" "..\electron\icon.ico"

  WriteRegStr HKCU "Software\Traco" "InstallDir" "$INSTDIR"
  DeleteRegValue HKCU "Software\Traco" "Glass" ; a caixa da página final grava de novo se a pessoa marcar

  ; atalhos
  CreateShortcut "$SMPROGRAMS\Traço.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\traco.ico" 0
  CreateShortcut "$DESKTOP\Traço.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\traco.ico" 0

  ; .traco abre com duplo clique
  WriteRegStr HKCU "Software\Classes\.traco" "" "Traco.Projeto"
  WriteRegStr HKCU "Software\Classes\Traco.Projeto" "" "Projeto Traço"
  WriteRegStr HKCU "Software\Classes\Traco.Projeto\DefaultIcon" "" '"$INSTDIR\traco.ico"'
  WriteRegStr HKCU "Software\Classes\Traco.Projeto\shell\open\command" "" '"$INSTDIR\${EXE}" "%1"'
  ; "Abrir no Traço" no botão direito de PDFs
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\Traco" "" "Abrir no Traço"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\Traco" "Icon" '"$INSTDIR\traco.ico"'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\Traco\command" "" '"$INSTDIR\${EXE}" "%1"'

  ; "Abrir com > Traço" no botão direito de PDFs (aparece na lista de programas sem virar o padrão do PDF)
  WriteRegStr HKCU "Software\Classes\Traco.PDF" "" "Documento PDF (Traço)"
  WriteRegStr HKCU "Software\Classes\Traco.PDF\DefaultIcon" "" '"$INSTDIR\traco.ico"'
  WriteRegStr HKCU "Software\Classes\Traco.PDF\shell\open" "FriendlyAppName" "Traço"
  WriteRegStr HKCU "Software\Classes\Traco.PDF\shell\open\command" "" '"$INSTDIR\${EXE}" "%1"'
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "Traco.PDF" ""
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}" "FriendlyAppName" "Traço"
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}\SupportedTypes" ".pdf" ""
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}\SupportedTypes" ".traco" ""
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}\DefaultIcon" "" '"$INSTDIR\traco.ico"'
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}\shell\open" "FriendlyAppName" "Traço"
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}\shell\open\command" "" '"$INSTDIR\${EXE}" "%1"'

  ; desinstalador (aparece em Configurações > Aplicativos)
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Traço"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Lottos Engenharia"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" '"$INSTDIR\traco.ico"'
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${UNKEY}" "EstimatedSize" "$0"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
SectionEnd

; atualização automática (electron-updater roda o instalador com /S --updated --force-run)
Function .onInstSuccess
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--force-run" $R1
  IfErrors 0 run
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  IfErrors done run
  run:
    Exec '"$INSTDIR\${EXE}"'
  done:
FunctionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Sleep 500
  Delete "$SMPROGRAMS\Traço.lnk"
  Delete "$DESKTOP\Traço.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Classes\.traco"
  DeleteRegKey HKCU "Software\Classes\Traco.Projeto"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\Traco"
  DeleteRegKey HKCU "Software\Classes\Traco.PDF"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "Traco.PDF"
  DeleteRegKey HKCU "Software\Classes\Applications\${EXE}"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegKey HKCU "Software\Traco"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ; projetos .traco e configurações em %APPDATA%\Traco são preservados
SectionEnd
