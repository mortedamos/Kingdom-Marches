<#
.SYNOPSIS
  Tiles a single frame PNG into an NxN grid to spot-check seamlessness
  before installing terrain art (see doc/art_style_guide.md section 9 —
  same-terrain tiling must be genuinely seamless since the renderer draws
  each tile independently with no blending).

.PARAMETER InputPath
  A single frame PNG (already resized to final tile size).

.PARAMETER OutputPath
  Where to save the tiled preview mosaic.

.PARAMETER Grid
  Number of tiles per side. Default 4 (4x4 mosaic).

.EXAMPLE
  .\tools\tile-preview.ps1 -InputPath frame.png -OutputPath preview.png -Grid 4
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [int]$Grid = 4
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
$w = $src.Width
$h = $src.Height

$out = New-Object System.Drawing.Bitmap ($w * $Grid), ($h * $Grid)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

for ($row = 0; $row -lt $Grid; $row++) {
    for ($col = 0; $col -lt $Grid; $col++) {
        $g.DrawImage($src, ($col * $w), ($row * $h), $w, $h)
    }
}

$g.Dispose()
$outDir = Split-Path -Parent $OutputPath
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$out.Save((Join-Path (Get-Location) $OutputPath))
$src.Dispose()
$out.Dispose()

Write-Host "Saved $OutputPath ($Grid x $Grid tiling of $w x $h source)"
