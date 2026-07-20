<#
.SYNOPSIS
  Generates the three road-overlay stub graphics used by the draw-time
  road compositor (see js/ui/render.js drawRoadOverlay). Roads are NOT
  pre-baked per connection combination -- instead these mostly-transparent
  64x64 stubs are layered (rotated 0/90/180/270) at render time to build
  any of the 256 possible 8-neighbor connection states:

    road_cardinal.png -- a stub from tile CENTER to the middle of one
                         EDGE. Authored pointing EAST (+x). Rotated by
                         0/90/180/270 to reach N/E/S/W.
    road_diagonal.png -- a stub from tile CENTER to one CORNER. Authored
                         pointing NE (up-right). Rotated by 0/90/180/270
                         to reach the four corners. A separate art (not
                         the cardinal rotated 45) is required because
                         center->corner is sqrt(2)x longer than
                         center->edge on a square tile.
    road_hub.png      -- a small rimless tan patch at the tile CENTER.
                         Drawn on every road tile: fills the join where
                         stubs meet, AND stands alone as the "road to
                         nowhere" for an isolated tile with no neighbors.

  Design constraints (from the user):
   * NO dark border/rim between road and transparency. A rim makes
     overlapping/adjacent road pieces show hard seam lines where their
     borders meet -- roads must be a single flat tan that merges
     seamlessly tan-on-tan wherever pieces stack. (This is also why no
     separate center-seal asset is needed anymore.)
   * NOT perfectly straight -- edges gently wobble so the road reads as a
     rough, natural dirt path, not a geometric bar. The wobble is tapered
     to near-zero right at the tile CENTER and right at the EDGE/CORNER
     crossing, so adjacent tiles' roads still align and connect cleanly;
     the roughness lives in the middle stretch.

  Drawn programmatically (not via Gemini) because the layering only works
  if every stub's endpoints land EXACTLY at the tile center and its
  edge-midpoint / corner -- pixel-precise anchoring Gemini can't
  guarantee.

.PARAMETER OutputDir
  Directory to write the PNGs into. Default assets/roads.
#>

param(
    [string]$OutputDir = "assets/roads"
)

Add-Type -AssemblyName System.Drawing

$size   = 64
$center = 32.0

# Single flat dirt-road tan -- NO rim. Subtle darker/lighter dabs give a
# little dirt texture without introducing any hard edge.
$roadColor = [System.Drawing.Color]::FromArgb(255, 176, 146, 94)   # #b0925e
$darkDab   = [System.Drawing.Color]::FromArgb(70, 128, 104, 62)    # subtle darker tan
$lightDab  = [System.Drawing.Color]::FromArgb(55, 205, 178, 120)   # subtle lighter tan

$baseHW    = 7.0    # road half-width (full width ~14px, ~0.22 of tile)
$wobbleAmp = 2.0    # centerline lateral wander (px)
$edgeAmp   = 1.7    # independent top/bottom edge roughness (px)
$overshoot = 4.0    # start this far PAST center so stubs overlap seamlessly
$samples   = 26

# Taper for wobble/roughness: 0 at the very ends, full through the middle,
# so the center and the edge/corner crossing stay clean for connections
# while the middle stretch is rough. Ramp up 0..0.25, flat, ramp down
# 0.70..1.0 (the visible edge crossing sits near t~0.9, already tapering).
function Get-Taper($t) {
    if ($t -lt 0.25) { return $t / 0.25 }
    elseif ($t -gt 0.70) { return [Math]::Max(0.0, (1.0 - $t) / 0.30) }
    else { return 1.0 }
}

# Builds a filled, rimless, gently-wavy band from point A (center side,
# overshot) to point B (edge/corner side, overshot past the boundary).
# dirX/dirY = unit axis direction; perpendicular is (-dirY, dirX).
function Draw-Band($g, $ax, $ay, $bx, $by, $dirX, $dirY) {
    $perpX = -$dirY
    $perpY = $dirX
    $top = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $bot = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    for ($i = 0; $i -le $samples; $i++) {
        $t = $i / [double]$samples
        $tap = Get-Taper $t
        $wob = $wobbleAmp * [Math]::Sin($t * [Math]::PI * 2.3 + 0.7) * $tap
        $nt  = $edgeAmp   * [Math]::Sin($t * [Math]::PI * 3.7 + 1.9) * $tap
        $nb  = $edgeAmp   * [Math]::Sin($t * [Math]::PI * 3.1 + 4.3) * $tap
        $cx = $ax + $t * ($bx - $ax) + $perpX * $wob
        $cy = $ay + $t * ($by - $ay) + $perpY * $wob
        $htop = $baseHW + $nt
        $hbot = $baseHW + $nb
        $top.Add((New-Object System.Drawing.PointF([single]($cx + $perpX * $htop), [single]($cy + $perpY * $htop))))
        $bot.Add((New-Object System.Drawing.PointF([single]($cx - $perpX * $hbot), [single]($cy - $perpY * $hbot))))
    }
    $poly = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $poly.AddRange($top)
    $bot.Reverse()
    $poly.AddRange($bot)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddPolygon($poly.ToArray())

    $brush = New-Object System.Drawing.SolidBrush($roadColor)
    $g.FillPath($brush, $path)
    $brush.Dispose()

    # Dirt texture: a few subtle dabs, clipped to the road so nothing
    # spills past the (rimless) edge.
    $g.SetClip($path)
    $rng = New-Object System.Random 1337
    for ($k = 0; $k -lt 10; $k++) {
        $t = 0.15 + 0.7 * $rng.NextDouble()
        $off = ($rng.NextDouble() * 2 - 1) * $baseHW * 0.7
        $cx = $ax + $t * ($bx - $ax) + $perpX * $off
        $cy = $ay + $t * ($by - $ay) + $perpY * $off
        $r = 2.0 + 2.5 * $rng.NextDouble()
        $col = if ($k % 2 -eq 0) { $darkDab } else { $lightDab }
        $db = New-Object System.Drawing.SolidBrush($col)
        $g.FillEllipse($db, [single]($cx - $r), [single]($cy - $r), [single]($r * 2), [single]($r * 2))
        $db.Dispose()
    }
    $g.ResetClip()
    $path.Dispose()
}

function New-Canvas {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    return @{ bmp = $bmp; g = $g }
}

function Save-Canvas($c, $name) {
    $c.g.Dispose()
    $c.bmp.Save((Join-Path (Get-Location) (Join-Path $OutputDir $name)), [System.Drawing.Imaging.ImageFormat]::Png)
    $c.bmp.Dispose()
}

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null }

# --- Cardinal stub: center -> EAST edge midpoint. A overshoots west past
# center, B overshoots east past the edge (clipped at 64). ---
$c = New-Canvas
Draw-Band $c.g ($center - $overshoot) $center ($size + $overshoot) $center 1.0 0.0
Save-Canvas $c "road_cardinal.png"

# --- Diagonal stub: center -> NE corner (64,0). Axis dir = (1,-1)/sqrt2. ---
$c = New-Canvas
$dx = 1.0 / [Math]::Sqrt(2.0); $dy = -1.0 / [Math]::Sqrt(2.0)
$ax = $center - $overshoot * $dx; $ay = $center - $overshoot * $dy
$bx = $size + $overshoot * $dx;   $by = 0.0 + $overshoot * $dy
Draw-Band $c.g $ax $ay $bx $by $dx $dy
Save-Canvas $c "road_diagonal.png"

# --- Hub: rimless tan patch at center. Center-join filler + isolated
# "road to nowhere". Slightly irregular blob, not a perfect circle. ---
$c = New-Canvas
$hubPts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
$hubRng = New-Object System.Random 99
for ($a = 0; $a -lt 360; $a += 30) {
    $rad = $a * [Math]::PI / 180.0
    $rr = $baseHW + 1.0 + ($hubRng.NextDouble() * 2 - 1) * 1.2
    $hubPts.Add((New-Object System.Drawing.PointF([single]($center + [Math]::Cos($rad) * $rr), [single]($center + [Math]::Sin($rad) * $rr))))
}
$hubPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$hubPath.AddClosedCurve($hubPts.ToArray())
$hubBrush = New-Object System.Drawing.SolidBrush($roadColor)
$c.g.FillPath($hubBrush, $hubPath)
$hubBrush.Dispose(); $hubPath.Dispose()
Save-Canvas $c "road_hub.png"

Write-Host "Saved road_cardinal.png, road_diagonal.png, road_hub.png to $OutputDir"
