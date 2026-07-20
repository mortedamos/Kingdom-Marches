<#
.SYNOPSIS
  Post-process fix for terrain tiles installed before chroma-key.ps1 had
  -SeamlessEdges: forces the outer few pixels of each edge to match their
  wrapped opposite edge, eliminating the faint resize-interpolation seam
  confirmed via tools/tile-preview.ps1 (see doc/art_style_guide.md §9,
  "Resize step must use -SeamlessEdges for terrain"). Operates directly on
  already-installed, already-approved art -- no regeneration, no guessing
  which draft version was final.

.PARAMETER InputPath
  A single frame PNG, or a horizontal multi-frame sheet (each frame
  FrameWidth x full-height, standard game convention).

.PARAMETER OutputPath
  Where to save the fixed PNG.

.PARAMETER FrameWidth
  Width of a single frame. Defaults to image height (assumes square
  frames, the terrain convention).

.PARAMETER BlendPx
  How many pixels in from each edge get feathered toward their wrapped
  opposite-edge match. Default 3.

.EXAMPLE
  .\tools\make-seamless.ps1 -InputPath assets\terrain\plains_1.png -OutputPath assets\terrain\plains_1.png -FrameWidth 64
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [int]$FrameWidth = 0,
    [int]$BlendPx = 3
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
$bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$g.Dispose()
$src.Dispose()

if ($FrameWidth -le 0) { $FrameWidth = $bmp.Height }
$frameHeight = $bmp.Height
$numFrames = [int]($bmp.Width / $FrameWidth)

$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $bmp.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

function Get-Px($bytes, $stride, $x, $y) {
    $i = $y * $stride + $x * 4
    return @($bytes[$i], $bytes[$i+1], $bytes[$i+2], $bytes[$i+3])
}
function Set-Px($bytes, $stride, $x, $y, $c) {
    $i = $y * $stride + $x * 4
    $bytes[$i]   = [byte]$c[0]
    $bytes[$i+1] = [byte]$c[1]
    $bytes[$i+2] = [byte]$c[2]
    $bytes[$i+3] = [byte]$c[3]
}

for ($f = 0; $f -lt $numFrames; $f++) {
    $fx0 = $f * $FrameWidth

    # Horizontal wrap: blend left edge columns with right edge columns.
    for ($y = 0; $y -lt $frameHeight; $y++) {
        for ($i = 0; $i -lt $BlendPx; $i++) {
            $leftX = $fx0 + $i
            $rightX = $fx0 + $FrameWidth - 1 - $i
            $w = (($BlendPx - $i) / [double]$BlendPx) * 0.5
            $l = Get-Px $bytes $stride $leftX $y
            $r = Get-Px $bytes $stride $rightX $y
            $newL = @(0,0,0,0)
            $newR = @(0,0,0,0)
            for ($c = 0; $c -lt 4; $c++) {
                $newL[$c] = $l[$c] * (1 - $w) + $r[$c] * $w
                $newR[$c] = $r[$c] * (1 - $w) + $l[$c] * $w
            }
            Set-Px $bytes $stride $leftX $y $newL
            Set-Px $bytes $stride $rightX $y $newR
        }
    }

    # Vertical wrap: blend top edge rows with bottom edge rows.
    for ($x = 0; $x -lt $FrameWidth; $x++) {
        for ($i = 0; $i -lt $BlendPx; $i++) {
            $topY = $i
            $botY = $frameHeight - 1 - $i
            $w = (($BlendPx - $i) / [double]$BlendPx) * 0.5
            $absX = $fx0 + $x
            $t = Get-Px $bytes $stride $absX $topY
            $b = Get-Px $bytes $stride $absX $botY
            $newT = @(0,0,0,0)
            $newB = @(0,0,0,0)
            for ($c = 0; $c -lt 4; $c++) {
                $newT[$c] = $t[$c] * (1 - $w) + $b[$c] * $w
                $newB[$c] = $b[$c] * (1 - $w) + $t[$c] * $w
            }
            Set-Px $bytes $stride $absX $topY $newT
            Set-Px $bytes $stride $absX $botY $newB
        }
    }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$bmp.UnlockBits($data)

$outDir = Split-Path -Parent $OutputPath
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$bmp.Save((Join-Path (Get-Location) $OutputPath), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Saved $OutputPath ($numFrames frame(s), blended $BlendPx px per edge)"
