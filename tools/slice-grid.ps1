<#
.SYNOPSIS
  Slices a single grid image (e.g. a 2x2-panel sprite sheet generated in
  one API call) into individual per-panel PNGs, in row-major order.

.PARAMETER InputPath
  The grid image to slice.

.PARAMETER Rows
  Number of panel rows.

.PARAMETER Cols
  Number of panel columns.

.PARAMETER OutputDir
  Directory to write panel_1.png, panel_2.png, ... into (row-major:
  top-left, top-right, ..., bottom-right).

.PARAMETER EdgeTrim
  Pixels to inset from each panel's computed edge before saving. Grid
  divider lines drawn by the model rarely land exactly on the computed
  midpoint, so a naive exact-math slice can leave a thin sliver of the
  divider on a panel edge (confirmed in practice — see
  doc/art_style_guide.md). Default 6px (at typical ~512px panel size)
  comfortably clears the divider without cropping into the character,
  which is usually centered with real padding.

.EXAMPLE
  .\tools\slice-grid.ps1 -InputPath sheet.png -Rows 2 -Cols 2 -OutputDir out
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [int]$Rows = 2,
    [int]$Cols = 2,
    [Parameter(Mandatory = $true)][string]$OutputDir,
    [int]$EdgeTrim = 6
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($InputPath)
$panelW = [Math]::Floor($src.Width / $Cols)
$panelH = [Math]::Floor($src.Height / $Rows)

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }

$n = 0
for ($r = 0; $r -lt $Rows; $r++) {
    for ($c = 0; $c -lt $Cols; $c++) {
        $n++
        $panel = New-Object System.Drawing.Bitmap($panelW, $panelH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($panel)
        $srcX = ($c * $panelW) + $EdgeTrim
        $srcY = ($r * $panelH) + $EdgeTrim
        $srcW = $panelW - ($EdgeTrim * 2)
        $srcH = $panelH - ($EdgeTrim * 2)
        $srcRect = New-Object System.Drawing.Rectangle($srcX, $srcY, $srcW, $srcH)
        $destRect = New-Object System.Drawing.Rectangle(0, 0, $panelW, $panelH)
        $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Dispose()
        $outPath = Join-Path $OutputDir "panel_$n.png"
        $panel.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $panel.Dispose()
        "Saved $outPath (${panelW}x${panelH}, trimmed ${EdgeTrim}px and rescaled back up)"
    }
}
$src.Dispose()
