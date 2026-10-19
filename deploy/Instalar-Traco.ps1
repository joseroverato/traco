# Instala o Traço para o usuário atual (sem precisar de administrador)
$ErrorActionPreference = 'Stop'
$origem  = Join-Path $PSScriptRoot 'Traco'
$destino = Join-Path $env:LOCALAPPDATA 'Programs\Traco'
$exe     = Join-Path $destino 'Traco.exe'
$icone   = Join-Path $destino 'traco.ico'

Write-Host 'Instalando o Traço em' $destino
Get-Process Traco -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $destino) { Remove-Item $destino -Recurse -Force }
New-Item -ItemType Directory -Path $destino -Force | Out-Null
Copy-Item -Path (Join-Path $origem '*') -Destination $destino -Recurse -Force
Copy-Item -Path (Join-Path $PSScriptRoot 'traco.ico') -Destination $icone -Force

# atalhos (Menu Iniciar e Área de Trabalho)
$shell = New-Object -ComObject WScript.Shell
foreach ($pasta in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
  $lnk = $shell.CreateShortcut((Join-Path $pasta 'Traço.lnk'))
  $lnk.TargetPath = $exe
  $lnk.WorkingDirectory = $destino
  $lnk.IconLocation = $icone
  $lnk.Description = 'Traço — revisão de pranchas e quantitativos'
  $lnk.Save()
}

# abrir arquivos .traco com duplo clique (só para este usuário)
$cls = 'HKCU:\Software\Classes'
New-Item -Path "$cls\.traco" -Force | Out-Null
Set-ItemProperty -Path "$cls\.traco" -Name '(default)' -Value 'Traco.Projeto'
New-Item -Path "$cls\Traco.Projeto\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$cls\Traco.Projeto" -Name '(default)' -Value 'Projeto Traço'
Set-ItemProperty -Path "$cls\Traco.Projeto\DefaultIcon" -Name '(default)' -Value "`"$icone`""
New-Item -Path "$cls\Traco.Projeto\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$cls\Traco.Projeto\shell\open\command" -Name '(default)' -Value "`"$exe`" `"%1`""
# "Abrir com o Traço" no menu de contexto de PDFs
New-Item -Path "$cls\SystemFileAssociations\.pdf\shell\Traco\command" -Force | Out-Null
Set-ItemProperty -Path "$cls\SystemFileAssociations\.pdf\shell\Traco" -Name '(default)' -Value 'Abrir no Traço'
Set-ItemProperty -Path "$cls\SystemFileAssociations\.pdf\shell\Traco" -Name 'Icon' -Value "`"$icone`""
Set-ItemProperty -Path "$cls\SystemFileAssociations\.pdf\shell\Traco\command" -Name '(default)' -Value "`"$exe`" `"%1`""

# desinstalador
$des = @"
Get-Process Traco -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item '$destino' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Traço.lnk') -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Traço.lnk') -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\Software\Classes\.traco' -Recurse -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\Software\Classes\Traco.Projeto' -Recurse -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\Software\Classes\SystemFileAssociations\.pdf\shell\Traco' -Recurse -ErrorAction SilentlyContinue
Write-Host 'Traço removido. Seus projetos .traco não foram apagados.'
"@
$des | Out-File -FilePath (Join-Path $PSScriptRoot 'Desinstalar-Traco.ps1') -Encoding utf8

Write-Host ''
Write-Host 'Pronto! Abra o Traço pelo atalho na Área de Trabalho ou no Menu Iniciar.' -ForegroundColor Green
Start-Process $exe
