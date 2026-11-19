# Gera os quadros da prévia animada do instalador a partir de docs/demo.gif.
# Uso: pwsh deploy/make-frames.ps1   (grava deploy/frames/f01.bmp … f12.bmp, 24 bits, 320×180)
# Os quadros ficam versionados: só precisa rodar de novo quando o demo.gif mudar.
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$gif = [System.Drawing.Image]::FromFile((Join-Path $root 'docs\demo.gif'))
$dim = New-Object System.Drawing.Imaging.FrameDimension($gif.FrameDimensionsList[0])
$total = $gif.GetFrameCount($dim)
$n = 12; $w = 320; $h = 180
$out = Join-Path $PSScriptRoot 'frames'
New-Item -ItemType Directory -Force $out | Out-Null
for ($i = 0; $i -lt $n; $i++) {
  $gif.SelectActiveFrame($dim, [int][math]::Floor($i * ($total - 1) / ($n - 1))) | Out-Null
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($gif, 0, 0, $w, $h)
  $g.Dispose()
  $bmp.Save((Join-Path $out ('f{0:d2}.bmp' -f ($i + 1))), [System.Drawing.Imaging.ImageFormat]::Bmp)
  $bmp.Dispose()
}
$gif.Dispose()
"$n quadros em $out"
