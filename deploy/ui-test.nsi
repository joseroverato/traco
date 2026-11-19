; Só para olhar as telas do instalador (não instala nada): makensis ui-test.nsi && release\ui-test.exe [/THEME=dark|light]
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!define VERSION "0.0.0"
!define APPNAME "Traço"
!define EXE "notepad.exe"
!define TRACO_UI_TEST
Name "${APPNAME}"
OutFile "..\release\ui-test.exe"
InstallDir "$TEMP\traco-ui-test"
RequestExecutionLevel user
ManifestDPIAware true
BrandingText " "

!include "ui.nsh"

Function .onInit
  Call UiInit
FunctionEnd

Function GlassOff
FunctionEnd

Section "Teste"
  Sleep 1500
SectionEnd

Section "Uninstall"
SectionEnd
