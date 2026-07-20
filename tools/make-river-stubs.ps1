<#
.SYNOPSIS
  Generates the river-overlay stub graphics used by the draw-time river
  compositor (see js/ui/render.js drawRiverOverlay). Same technique as
  tools/make-road-stubs.ps1 (see that file for the full rationale), adapted
  to the river data model:

    river_cardinal.png -- a stub from tile CENTER to the middle of one
                          EDGE. Authored pointing EAST. Rotated by
                          0/90/180/270 to reach N/E/S/W.
    river_hub.png       -- a small rimless water-colored patch at the tile
                          CENTER. Drawn on every river tile: blends
                          wherever stub(s) meet, and doubles as a small
                          "spring/pool" look for a tile with only one
                          flagged edge (a river source or mouth).

  Unlike roads, worldgen (js/engine/worldgen.js generateRivers) only ever
  flags CARDINAL edges (hasRiver.n/s/e/w) -- rivers never flow diagonally
  -- so there is no river_diagonal.png. Also unlike roads, a river tile's
  edges are looked up directly from that tile's own hasRiver flags (both
  banks of a shared border are stamped symmetrically at generation time),
  not by checking neighboring tiles.

  Same rimless, single-flat-tone, gently-wobbly-in-the-middle construction
  as the road stubs (no border so overlapping pieces merge seamlessly;
  wobble tapers to zero at the center and edge crossing so connections
  still line up). Rivers get a bit more sinuous wobble than roads (natural
  watercourses bend more than dirt paths) and a cool blue palette with
  subtle lighter ripple dabs instead of dirt dabs.

.PARAMETER OutputDir
  Directory to write the PNGs into. Default assets/rivers.
#>

param(
    [string]$OutputDir = "assets/rivers"
)

Add-Type -AssemblyName System.Drawing

$size   = 64
$center = 32.0

# Single flat river blue -- NO rim (must merge seamlessly, same reasoning
# as roads). Matches assets/terrain/coast_1.png's actual installed base
# color (#2c7694, sampled directly -- coast went through a palette pull
# toward ocean's blue after its original design, see recolor-shift.ps1)
# so a river reads as the same water, not a different-colored stream,
# where it meets the coastline. Subtle darker/lighter ripple dabs for a
# little water texture.
$riverColor = [System.Drawing.Color]::FromArgb(255, 44, 118, 148)   # #2c7694 -- matches coast_1 base
$darkDab    = [System.Drawing.Color]::FromArgb(60, 28, 80, 104)     # subtle darker blue
$lightDab   = [System.Drawing.Color]::FromArgb(70, 110, 170, 196)   # subtle lighter/foam blue

$baseHW    = 4.0    # river half-width (full width ~8px) -- thinner than roads (7)
$wobbleAmp = 2.5    # centerline lateral wander (px) -- sinuous, roughly matches roads (2.0)
$edgeAmp   = 1.4    # smooth base edge roughness (px) -- jaggedness comes mostly from jitter below
$jitterAmp = 2.0    # per-sample RANDOM edge perturbation (px) -- this is what reads as "jagged"
                    # rather than merely wavy: a smooth sine curve alone (however high-frequency)
                    # still looks like a smooth wiggle, so top/bottom edges each get their own
                    # seeded per-vertex jitter on top of the smooth term, tapered like everything
                    # else. Two independent seeds (not mirrored) so the banks don't zigzag in sync.
$overshoot = 4.0    # start this far PAST center so stubs overlap seamlessly
$samples   = 40     # more vertices than before (26) so jitter reads as jagged kinks, not a blur

# Taper for wobble/roughness: 0 at the very ends (center + edge crossing),
# full through the middle -- see make-road-stubs.ps1 for why.
function Get-Taper($t) {
    if ($t -lt 0.25) { return $t / 0.25 }
    elseif ($t -gt 0.70) { return [Math]::Max(0.0, (1.0 - $t) / 0.30) }
    else { return 1.0 }
}

function Draw-Band($g, $ax, $ay, $bx, $by, $dirX, $dirY) {
    $perpX = -$dirY
    $perpY = $dirX
    $top = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $bot = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    # Fixed seeds -- independent per edge (not mirrored) so the two banks
    # kink out of sync with each other, and reproducible across re-runs.
    $topRng = New-Object System.Random 501
    $botRng = New-Object System.Random 502
    for ($i = 0; $i -le $samples; $i++) {
        $t = $i / [double]$samples
        $tap = Get-Taper $t
        $wob = $wobbleAmp * [Math]::Sin($t * [Math]::PI * 2.1 + 0.9) * $tap
        $nt  = ($edgeAmp * [Math]::Sin($t * [Math]::PI * 3.3 + 2.2) + $jitterAmp * ($topRng.NextDouble() * 2 - 1)) * $tap
        $nb  = ($edgeAmp * [Math]::Sin($t * [Math]::PI * 2.8 + 4.7) + $jitterAmp * ($botRng.NextDouble() * 2 - 1)) * $tap
        $cx = $ax + $t * ($bx - $ax) + $perpX * $wob
        $cy = $ay + $t * ($by - $ay) + $perpY * $wob
        $htop = [Math]::Max(0.6, $baseHW + $nt)
        $hbot = [Math]::Max(0.6, $baseHW + $nb)
        $top.Add((New-Object System.Drawing.PointF([single]($cx + $perpX * $htop), [single]($cy + $perpY * $htop))))
        $bot.Add((New-Object System.Drawing.PointF([single]($cx - $perpX * $hbot), [single]($cy - $perpY * $hbot))))
    }
    $poly = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $poly.AddRange($top)
    $bot.Reverse()
    $poly.AddRange($bot)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddPolygon($poly.ToArray())

    $brush = New-Object System.Drawing.SolidBrush($riverColor)
    $g.FillPath($brush, $path)
    $brush.Dispose()

    $g.SetClip($path)
    $rng = New-Object System.Random 2024
    for ($k = 0; $k -lt 10; $k++) {
        $t = 0.15 + 0.7 * $rng.NextDouble()
        $off = ($rng.NextDouble() * 2 - 1) * $baseHW * 0.7
        $cx = $ax + $t * ($bx - $ax) + $perpX * $off
        $cy = $ay + $t * ($by - $ay) + $perpY * $off
        $r = 2.0 + 2.3 * $rng.NextDouble()
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

# --- Cardinal stub: center -> EAST edge midpoint ---
$c = New-Canvas
Draw-Band $c.g ($center - $overshoot) $center ($size + $overshoot) $center 1.0 0.0
Save-Canvas $c "river_cardinal.png"

# --- Hub: rimless water-colored patch at center. Centre-join filler +
# single-edge spring/mouth look. Slightly irregular blob. ---
$c = New-Canvas
$hubPts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
$hubRng = New-Object System.Random 77
for ($a = 0; $a -lt 360; $a += 30) {
    $rad = $a * [Math]::PI / 180.0
    $rr = $baseHW + 1.0 + ($hubRng.NextDouble() * 2 - 1) * 1.2
    $hubPts.Add((New-Object System.Drawing.PointF([single]($center + [Math]::Cos($rad) * $rr), [single]($center + [Math]::Sin($rad) * $rr))))
}
$hubPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$hubPath.AddClosedCurve($hubPts.ToArray())
$hubBrush = New-Object System.Drawing.SolidBrush($riverColor)
$c.g.FillPath($hubBrush, $hubPath)
$hubBrush.Dispose(); $hubPath.Dispose()
Save-Canvas $c "river_hub.png"

Write-Host "Saved river_cardinal.png, river_hub.png to $OutputDir"
