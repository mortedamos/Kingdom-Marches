<#
.SYNOPSIS
  Forces a wall tile's connecting edge(s) to have an EXACT opaque pixel
  range, so separately-generated wall orientation variants (horizontal/
  vertical/node) connect without a seam, gap, or width mismatch where
  they meet on adjacent tiles.

.DESCRIPTION
  Image generation doesn't reliably hit "touches exactly at pixel 0" or
  "same band width as this other separately-generated image" -- confirmed
  by measuring the shipped Elf wall art directly: node.png's top edge had
  ZERO opaque pixels (its circle fell ~3px short of the frame edge), and
  vertical.png's own top/bottom edges didn't match each other (self-tiling
  drift), among other mismatches against the horizontal/node pieces it
  needs to connect to.

  For a given edge (left/right/top/bottom) and a target opaque range
  [Start,End] along that edge, this scans inward from the TRUE edge at
  each position in range; if the true edge pixel isn't already opaque, it
  finds the nearest real opaque pixel along that scan line (within
  -MaxSearchDepth) and clamps/extends it outward to the edge, filling the
  gap. Positions with no real content within the search depth are left
  untouched (never invents wall texture out of nothing) rather than
  drawing something fake.

.PARAMETER InputPath
  PNG to modify.

.PARAMETER OutputPath
  Where to save. Defaults to overwriting InputPath.

.PARAMETER Edge
  "left" (x=0, scan +x), "right" (x=width-1, scan -x), "top" (y=0, scan +y),
  or "bottom" (y=height-1, scan -y).

.PARAMETER RangeStart / RangeEnd
  Inclusive pixel range along the edge (y-range for left/right, x-range
  for top/bottom) that must end up opaque at the true edge.

.PARAMETER MaxSearchDepth
  How far inward to search for real content to extend. Default 40.

.PARAMETER ClipOutsideRange
  Instead of extending TO the range, clear the true edge to transparent
  OUTSIDE [RangeStart,RangeEnd] (only at the single edge row/column
  itself, not clearing interior content) -- for the opposite case where
  this edge's native content is WIDER than the target and needs trimming
  down to match, rather than a narrower edge that needs extending.

.EXAMPLE
  # Force node.png's top edge to match vertical.png's canonical band
  .\tools\align-wall-edges.ps1 -InputPath assets\buildings\elf_wall_section_node.png `
    -Edge top -RangeStart 34 -RangeEnd 93
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [string]$OutputPath,
    [Parameter(Mandatory = $true)][ValidateSet("left", "right", "top", "bottom")][string]$Edge,
    [Parameter(Mandatory = $true)][int]$RangeStart,
    [Parameter(Mandatory = $true)][int]$RangeEnd,
    [int]$MaxSearchDepth = 40,
    [switch]$ClipOutsideRange
)

Add-Type -AssemblyName System.Drawing

if (-not $OutputPath) { $OutputPath = $InputPath }

$resolvedIn = (Resolve-Path $InputPath).Path
# Load via byte array / MemoryStream, not Bitmap.FromFile -- FromFile keeps the
# source file locked for the image's lifetime, which throws a generic GDI+
# error on Save() when -OutputPath overwrites the same path (the common case
# here). Fully decoding into memory first avoids holding that lock.
$bytes = [System.IO.File]::ReadAllBytes($resolvedIn)
$ms = New-Object System.IO.MemoryStream(,$bytes)
$bmp = New-Object System.Drawing.Bitmap($ms)
$w = $bmp.Width
$h = $bmp.Height

switch ($Edge) {
    "left"   { $dx = 1;  $dy = 0;  $edgeXFor = { param($i) 0 };         $edgeYFor = { param($i) $i } }
    "right"  { $dx = -1; $dy = 0;  $edgeXFor = { param($i) $w - 1 };    $edgeYFor = { param($i) $i } }
    "top"    { $dx = 0;  $dy = 1;  $edgeXFor = { param($i) $i };        $edgeYFor = { param($i) 0 } }
    "bottom" { $dx = 0;  $dy = -1; $edgeXFor = { param($i) $i };        $edgeYFor = { param($i) $h - 1 } }
}

$filled = 0
$skippedNoContent = 0
$clipped = 0

if ($ClipOutsideRange) {
    $edgeSize = if ($Edge -eq "left" -or $Edge -eq "right") { $h } else { $w }
    $transparent = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    for ($i = 0; $i -lt $edgeSize; $i++) {
        if ($i -ge $RangeStart -and $i -le $RangeEnd) { continue }
        $edgeX = & $edgeXFor $i
        $edgeY = & $edgeYFor $i
        if ($edgeX -lt 0 -or $edgeX -ge $w -or $edgeY -lt 0 -or $edgeY -ge $h) { continue }
        if ($bmp.GetPixel($edgeX, $edgeY).A -le 128) { continue } # already transparent
        $bmp.SetPixel($edgeX, $edgeY, $transparent)
        $clipped++
    }
} else {
    for ($i = $RangeStart; $i -le $RangeEnd; $i++) {
        $edgeX = & $edgeXFor $i
        $edgeY = & $edgeYFor $i
        if ($edgeX -lt 0 -or $edgeX -ge $w -or $edgeY -lt 0 -or $edgeY -ge $h) { continue }
        if ($bmp.GetPixel($edgeX, $edgeY).A -gt 128) { continue } # already opaque at the true edge

        $found = $false
        for ($k = 1; $k -le $MaxSearchDepth; $k++) {
            $sx = $edgeX + $dx * $k
            $sy = $edgeY + $dy * $k
            if ($sx -lt 0 -or $sx -ge $w -or $sy -lt 0 -or $sy -ge $h) { break }
            $px = $bmp.GetPixel($sx, $sy)
            if ($px.A -gt 128) {
                for ($f = 0; $f -le $k; $f++) {
                    $fx = $edgeX + $dx * $f
                    $fy = $edgeY + $dy * $f
                    $bmp.SetPixel($fx, $fy, $px)
                }
                $found = $true
                $filled++
                break
            }
        }
        if (-not $found) { $skippedNoContent++ }
    }
}

$bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$ms.Dispose()

[PSCustomObject]@{
    File             = Split-Path $OutputPath -Leaf
    Edge             = $Edge
    RangeRequested   = "$RangeStart-$RangeEnd"
    PositionsFilled  = $filled
    PositionsNoContentFound = $skippedNoContent
    PositionsClipped = $clipped
}
