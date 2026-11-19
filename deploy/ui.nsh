; Aparência do instalador do Traço: tema claro/escuro conforme o Windows, botões em pílula e prévia animada das funções.
; Incluído por installer.nsi (instalador real) e ui-test.nsi (só para olhar as telas, sem instalar nada).
; Espera: APPNAME, VERSION, EXE definidos; MUI2.nsh, FileFunc.nsh, LogicLib.nsh, WinMessages.nsh incluídos.

!include "nsDialogs.nsh"

!define MUI_ICON "..\electron\icon.ico"
!define MUI_UNICON "..\electron\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_WELCOMEPAGE_TITLE "Traço ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Revisão de pranchas, quantitativos e edição de PDF, com o motor completo (tarja definitiva, OCR) e integração com o Claude.$\r$\n$\r$\nA instalação é só para o seu usuário e não precisa de administrador."
!define MUI_FINISHPAGE_TITLE "Tudo pronto"
!define MUI_FINISHPAGE_TEXT "O Traço foi instalado. Ele aparece em $\"Abrir com$\" no botão direito de qualquer PDF e abre projetos .traco com duplo clique."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o Traço agora"
; segunda caixa da página final: desliga os painéis translúcidos (poupa a placa de vídeo em computadores mais simples)
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Desligar os efeitos de transparência (poupa a placa de vídeo)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION GlassOff

; segue o tema do Windows (claro/escuro): cores aplicadas a cada página
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ThemeWelcome
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE WelcomeLeave
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ThemeInner
!insertmacro MUI_PAGE_DIRECTORY
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ThemeInner
!insertmacro MUI_PAGE_INSTFILES
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ThemeFinish
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"
MiscButtonText "Voltar" "Avançar" "Cancelar" "Concluir"
InstallButtonText "Instalar"

; ---------------- cores (claro ou escuro conforme o Windows) ----------------
; SetCtlColors só aceita cores escritas no script (não variáveis): por isso uma macro com os dois temas.
Var Dark
Var hTitleFont
Var hBtnFont
Var hCapFont
Var Frame
Var hFrameBmp
Var hCaption

; COLORREF é BGR: #1C1C1E -> 0x1E1C1C
!define D_BG 0x1E1C1C
!define D_EDGE 0x44403F
!define D_TEXT 0xF7F5F5
!define D_DIM 0x736E6E
!define L_BG 0xFFFFFF
!define L_EDGE 0xD5D0D0
!define L_TEXT 0x1F1D1D
!define L_DIM 0xA6A1A1
!define ACCENT 0xFF8D4D
!define ACCENT_EDGE 0xFFB58F

!macro Paint hwnd kind
  ${If} $Dark == 1
    !if ${kind} == 1
      SetCtlColors ${hwnd} "F5F5F7" "1C1C1E"
    !else if ${kind} == 2
      SetCtlColors ${hwnd} "A1A1A6" "1C1C1E"
    !else
      SetCtlColors ${hwnd} "" "1C1C1E"
    !endif
  ${Else}
    !if ${kind} == 1
      SetCtlColors ${hwnd} "1D1D1F" "FFFFFF"
    !else if ${kind} == 2
      SetCtlColors ${hwnd} "6E6E73" "FFFFFF"
    !else
      SetCtlColors ${hwnd} "" "FFFFFF"
    !endif
  ${EndIf}
!macroend

; tema: o do Windows (aplicativos claro/escuro); /THEME=light ou /THEME=dark na linha de comando força um deles
Function SetTheme
  StrCpy $Dark 0
  ReadRegDWORD $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "AppsUseLightTheme"
  ${IfNot} ${Errors}
  ${AndIf} $0 == 0
    StrCpy $Dark 1
  ${EndIf}
  ClearErrors
  ${GetParameters} $1
  ${GetOptions} $1 "/THEME=" $2
  ${IfNot} ${Errors}
    ${If} $2 == "dark"
      StrCpy $Dark 1
    ${ElseIf} $2 == "light"
      StrCpy $Dark 0
    ${EndIf}
  ${EndIf}
  ClearErrors
FunctionEnd

; quadros da prévia (deploy/frames, gerados por make-frames.ps1 a partir de docs/demo.gif)
!define FRAMES 12
!macro ExtractFrame n
  File "/oname=$PLUGINSDIR\f${n}.bmp" "frames\f${n}.bmp"
!macroend

Function UiInit
  Call SetTheme
  ${If} $Dark == 1
    System::Call 'uxtheme::#135(i 2)' ; SetPreferredAppMode(ForceDark): caixas de seleção e campos no escuro
  ${EndIf}
  InitPluginsDir
  !insertmacro ExtractFrame 01
  !insertmacro ExtractFrame 02
  !insertmacro ExtractFrame 03
  !insertmacro ExtractFrame 04
  !insertmacro ExtractFrame 05
  !insertmacro ExtractFrame 06
  !insertmacro ExtractFrame 07
  !insertmacro ExtractFrame 08
  !insertmacro ExtractFrame 09
  !insertmacro ExtractFrame 10
  !insertmacro ExtractFrame 11
  !insertmacro ExtractFrame 12
FunctionEnd

Function DarkControl
  ; $R1 = controle
  ${If} $Dark == 1
    System::Call 'uxtheme::#133(p $R1, i 1)'
    System::Call 'uxtheme::SetWindowTheme(p $R1, w "DarkMode_Explorer", w n)'
  ${EndIf}
FunctionEnd

Function Fonts
  ${If} $hTitleFont == ""
    CreateFont $hTitleFont "Segoe UI Semibold" 18 600
    CreateFont $hBtnFont "Segoe UI Semibold" 9 600
    CreateFont $hCapFont "Segoe UI" 9 400
  ${EndIf}
FunctionEnd

; ---------------- botão em pílula ----------------
; Desenha o botão num bitmap (fundo da janela, borda de 1 px um tom mais clara, texto centralizado) e recorta a janela
; do botão em forma de pílula. Sem subclasse: o botão continua um botão comum do Windows, só com outra cara.
; $R1 = botão; $R3 = 1 quando é o principal (acento)
Function PillButton
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $8
  Push $9
  Call Fonts
  System::Call '*(i, i, i, i) p .r0'
  System::Call 'user32::GetClientRect(p $R1, p r0)'
  System::Call '*$0(i, i, i .r2, i .r3)'
  ${If} $2 < 8
    Goto done
  ${EndIf}
  ; cores conforme tema, estado e papel
  ${If} $Dark == 1
    StrCpy $5 ${D_BG}
    StrCpy $6 ${D_EDGE}
    StrCpy $7 ${D_TEXT}
    StrCpy $8 ${D_DIM}
  ${Else}
    StrCpy $5 ${L_BG}
    StrCpy $6 ${L_EDGE}
    StrCpy $7 ${L_TEXT}
    StrCpy $8 ${L_DIM}
  ${EndIf}
  System::Call 'user32::IsWindowEnabled(p $R1) i .r9'
  ${If} $R3 == 1
  ${AndIf} $9 <> 0
    StrCpy $6 ${ACCENT_EDGE}
    StrCpy $7 0xFFFFFF
    StrCpy $4 ${ACCENT}
  ${Else}
    StrCpy $4 $5
  ${EndIf}
  ${If} $9 == 0
    StrCpy $7 $8
  ${EndIf}
  ; bitmap compatível com a tela
  System::Call 'user32::GetDC(p 0) p .r8'
  System::Call 'gdi32::CreateCompatibleDC(p r8) p .r9'
  System::Call 'gdi32::CreateCompatibleBitmap(p r8, i r2, i r3) p .r1'
  System::Call 'gdi32::SelectObject(p r9, p r1)'
  System::Call 'gdi32::CreateSolidBrush(i r5) p .s'
  Pop $5
  System::Call 'user32::FillRect(p r9, p r0, p r5)'
  System::Call 'gdi32::DeleteObject(p r5)'
  System::Call 'gdi32::CreateSolidBrush(i r4) p .r4'
  System::Call 'gdi32::CreatePen(i 0, i 1, i r6) p .r6'
  System::Call 'gdi32::SelectObject(p r9, p r4)'
  System::Call 'gdi32::SelectObject(p r9, p r6)'
  System::Call 'gdi32::RoundRect(p r9, i 0, i 0, i r2, i r3, i r3, i r3)'
  System::Call 'gdi32::SetBkMode(p r9, i 1)'
  System::Call 'gdi32::SetTextColor(p r9, i r7)'
  System::Call 'gdi32::SelectObject(p r9, p $hBtnFont)'
  System::Call 'user32::GetWindowText(p $R1, t .r7, i 128)'
  System::Call 'user32::DrawText(p r9, t r7, i -1, p r0, i 0x100025)' ; DT_CENTER|DT_VCENTER|DT_SINGLELINE|DT_HIDEPREFIX
  System::Call 'gdi32::GetStockObject(i 0) p .s' ; WHITE_BRUSH
  Pop $5
  System::Call 'gdi32::SelectObject(p r9, p r5)'
  System::Call 'gdi32::GetStockObject(i 8) p .s' ; NULL_PEN
  Pop $5
  System::Call 'gdi32::SelectObject(p r9, p r5)'
  System::Call 'gdi32::DeleteObject(p r4)'
  System::Call 'gdi32::DeleteObject(p r6)'
  System::Call 'gdi32::DeleteDC(p r9)'
  System::Call 'user32::ReleaseDC(p 0, p r8)'
  ; aplica: estilo BS_BITMAP, bitmap antigo liberado, janela recortada em pílula
  SendMessage $R1 ${WM_SETFONT} $hBtnFont 0
  System::Call 'user32::GetWindowLong(p $R1, i -16) i .r5'
  IntOp $5 $5 | 0x80
  System::Call 'user32::SetWindowLong(p $R1, i -16, i r5)'
  SendMessage $R1 ${BM_GETIMAGE} 0 0 $5
  SendMessage $R1 ${BM_SETIMAGE} 0 $1
  ${If} $5 <> 0
    System::Call 'gdi32::DeleteObject(p r5)'
  ${EndIf}
  IntOp $2 $2 + 1
  IntOp $3 $3 + 1
  System::Call 'gdi32::CreateRoundRectRgn(i 0, i 0, i r2, i r3, i r3, i r3) p .r5'
  System::Call 'user32::SetWindowRgn(p $R1, p r5, i 1)'
  done:
  System::Free $0
  Pop $9
  Pop $8
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; pinta a janela externa: fundo, rodapé com os botões e barra de título
Function ThemeChrome
  !insertmacro Paint $HWNDPARENT 0
  ${ForEach} $R0 1034 1038 + 1
    GetDlgItem $R1 $HWNDPARENT $R0
    ${If} $R1 <> 0
      !insertmacro Paint $R1 1
    ${EndIf}
  ${Next}
  GetDlgItem $R1 $HWNDPARENT 1028
  !insertmacro Paint $R1 2
  ${If} $Dark == 1
    System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
  ${EndIf}
  ; sem o retângulo pontilhado de foco por cima das pílulas
  SendMessage $HWNDPARENT ${WM_UPDATEUISTATE} 0x10001 0
  ; 1 = Avançar/Instalar/Concluir (principal), 2 = Cancelar, 3 = Voltar
  ${ForEach} $R0 1 3 + 1
    GetDlgItem $R1 $HWNDPARENT $R0
    ${If} $R0 == 1
      StrCpy $R3 1
    ${Else}
      StrCpy $R3 0
    ${EndIf}
    Call PillButton
  ${Next}
FunctionEnd

; ---------------- boas-vindas: texto à esquerda, prévia animada à direita ----------------
; $R1 = controle a mover, $0..$3 = x, y, largura, altura
Function Place
  System::Call 'user32::SetWindowPos(p $R1, p 0, i r0, i r1, i r2, i r3, i 0x14)'
FunctionEnd

Function ShowFrame
  ${NSD_SetStretchedImage} $mui.WelcomePage.Image "$PLUGINSDIR\f$Frame.bmp" $0
  ${NSD_FreeImage} $hFrameBmp
  StrCpy $hFrameBmp $0
FunctionEnd

Function WelcomeTick
  IntOp $0 $Frame + 1
  ${If} $0 > ${FRAMES}
    StrCpy $0 1
  ${EndIf}
  IntFmt $Frame "%02d" $0
  Call ShowFrame
FunctionEnd

Function ThemeWelcome
  Call ThemeChrome
  Call Fonts
  !insertmacro Paint $mui.WelcomePage 0
  !insertmacro Paint $mui.WelcomePage.Title 1
  !insertmacro Paint $mui.WelcomePage.Text 2
  SendMessage $mui.WelcomePage.Title ${WM_SETFONT} $hTitleFont 1
  ; medidas da página (em pixels, já na escala da tela)
  System::Call '*(i, i, i, i) p .r4'
  System::Call 'user32::GetClientRect(p $mui.WelcomePage, p r4)'
  System::Call '*$4(i, i, i .r5, i .r6)'
  System::Free $4
  IntOp $7 $5 * 6 ; margem = 6 % da largura
  IntOp $7 $7 / 100
  IntOp $8 $5 * 42 ; coluna de texto = 42 %
  IntOp $8 $8 / 100
  ; título e texto
  StrCpy $R1 $mui.WelcomePage.Title
  StrCpy $0 $7
  IntOp $1 $6 * 20
  IntOp $1 $1 / 100
  StrCpy $2 $8
  IntOp $3 $6 * 14
  IntOp $3 $3 / 100
  Call Place
  StrCpy $R1 $mui.WelcomePage.Text
  IntOp $1 $1 + $3
  IntOp $1 $1 + 6
  IntOp $3 $6 * 55
  IntOp $3 $3 / 100
  Call Place
  ; prévia: 16:9 na coluna da direita, cantos arredondados
  IntOp $0 $7 + $8
  IntOp $0 $0 + $7
  IntOp $2 $5 - $0
  IntOp $2 $2 - $7
  IntOp $3 $2 * 9
  IntOp $3 $3 / 16
  IntOp $1 $6 - $3
  IntOp $1 $1 / 2
  IntOp $1 $1 - 10
  StrCpy $R1 $mui.WelcomePage.Image
  Call Place
  IntOp $9 $2 + 1
  IntOp $R0 $3 + 1
  System::Call 'gdi32::CreateRoundRectRgn(i 0, i 0, i r9, i R0, i 24, i 24) p .r9'
  System::Call 'user32::SetWindowRgn(p $mui.WelcomePage.Image, p r9, i 1)'
  ; legenda embaixo da prévia
  IntOp $1 $1 + $3
  IntOp $1 $1 + 8
  ${NSD_CreateLabel} 0 0 10 10 "Medir áreas na prancha e gerar o quantitativo"
  Pop $hCaption
  !insertmacro Paint $hCaption 2
  SendMessage $hCaption ${WM_SETFONT} $hCapFont 0
  StrCpy $R1 $hCaption
  StrCpy $3 36
  Call Place
  ; animação
  StrCpy $Frame "01"
  Call ShowFrame
  ${NSD_CreateTimer} WelcomeTick 650
FunctionEnd

Function WelcomeLeave
  ${NSD_KillTimer} WelcomeTick
FunctionEnd

Function ThemeFinish
  Call ThemeChrome
  Call Fonts
  !insertmacro Paint $mui.FinishPage 0
  !insertmacro Paint $mui.FinishPage.Title 1
  !insertmacro Paint $mui.FinishPage.Text 2
  !insertmacro Paint $mui.FinishPage.Run 1
  !insertmacro Paint $mui.FinishPage.ShowReadme 1
  StrCpy $R1 $mui.FinishPage.Run
  Call DarkControl
  StrCpy $R1 $mui.FinishPage.ShowReadme
  Call DarkControl
  SendMessage $mui.FinishPage.Title ${WM_SETFONT} $hTitleFont 1
  ; sem a faixa lateral: o texto ocupa a largura toda, a partir da margem
  ShowWindow $mui.FinishPage.Image ${SW_HIDE}
  System::Call '*(i, i, i, i) p .r4'
  System::Call 'user32::GetClientRect(p $mui.FinishPage, p r4)'
  System::Call '*$4(i, i, i .r5, i .r6)'
  System::Free $4
  IntOp $7 $5 * 7
  IntOp $7 $7 / 100
  IntOp $8 $5 - $7
  IntOp $8 $8 - $7
  StrCpy $R1 $mui.FinishPage.Title
  StrCpy $0 $7
  IntOp $1 $6 * 18
  IntOp $1 $1 / 100
  StrCpy $2 $8
  IntOp $3 $6 * 14
  IntOp $3 $3 / 100
  Call Place
  StrCpy $R1 $mui.FinishPage.Text
  IntOp $1 $1 + $3
  IntOp $1 $1 + 6
  IntOp $3 $6 * 22
  IntOp $3 $3 / 100
  Call Place
  StrCpy $R1 $mui.FinishPage.Run
  IntOp $1 $1 + $3
  IntOp $1 $1 + 10
  StrCpy $3 24
  Call Place
  StrCpy $R1 $mui.FinishPage.ShowReadme
  IntOp $1 $1 + 30
  Call Place
FunctionEnd

; páginas com a janela interna padrão (pasta de instalação e progresso)
Function ThemeInner
  Call ThemeChrome
  FindWindow $R2 "#32770" "" $HWNDPARENT
  !insertmacro Paint $R2 0
  ${ForEach} $R0 1000 1030 + 1
    GetDlgItem $R1 $R2 $R0
    ${If} $R1 <> 0
      System::Call 'user32::GetClassName(p $R1, t .r3, i 32)'
      ${If} $3 == "Button"
      ${AndIf} $R0 == 1020
        ShowWindow $R1 ${SW_HIDE} ; a moldura "Pasta Destino" some: o campo e o botão bastam
      ${ElseIf} $3 == "Static"
        !insertmacro Paint $R1 1
      ${ElseIf} $3 == "Edit"
        !insertmacro Paint $R1 1
      ${ElseIf} $3 == "Button"
        System::Call 'user32::GetWindowLong(p $R1, i -16) i .r4'
        IntOp $4 $4 & 0xF
        ${If} $4 <= 1 ; só botões de apertar (Procurar…); caixas de seleção continuam como são
          StrCpy $R3 0
          Call PillButton
        ${Else}
          Call DarkControl
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${Next}
FunctionEnd
