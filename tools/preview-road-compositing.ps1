<#
.SYNOPSIS
  Verification-only: composites the road stubs (rotated 0/90/180/270,
  exactly as js/ui/render.js drawRoadOverlay will at runtime) over a
  terrain tile for several 8-neighbor connection patterns, so the stub
  geometry can be eyeballed before wiring the real render path. Not part
  of the shipped asset pipeline.
#>

Add-Type -AssemblyName System.Drawing

$ts = 64
$cardinal = [System.Drawing.Image]::FromFile((Resolve-Path "assets\roads\road_cardinal.png"))
$diagonal = [System.Drawing.Image]::FromFile((Resolve-Path "assets\roads\road_diagonal.png"))
$hub      = [System.Drawing.Image]::FromFile((Resolve-Path "assets\roads\road_hub.png"))
$terrain  = [System.Drawing.Image]::FromFile((Resolve-Path "assets\terrain\plains_1.png"))

# angle (deg) per direction, matching drawRoadOverlay
$cardAng = @{ e = 0; s = 90; w = 180; n = 270 }
$diagAng = @{ ne = 0; se = 90; sw = 180; nw = 270 }

function Draw-Stub($g, $img, $angleDeg) {
    $g.TranslateTransform([single]($ts/2), [single]($ts/2))
    $g.RotateTransform([single]$angleDeg)
    $g.DrawImage($img, [single](-$ts/2), [single](-$ts/2), [single]$ts, [single]$ts)
    $g.ResetTransform()
}

function Render-Tile($conn) {
    $bmp = New-Object System.Drawing.Bitmap($ts, $ts, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    # terrain background (frame 0 of the sheet)
    $g.DrawImage($terrain, (New-Object System.Drawing.Rectangle(0,0,$ts,$ts)), 0,0,$ts,$ts, [System.Drawing.GraphicsUnit]::Pixel)
    # hub always: fills the center join (and stands alone when isolated)
    Draw-Stub $g $hub 0
    foreach ($d in "e","s","w","n") { if ($conn -contains $d) { Draw-Stub $g $cardinal $cardAng[$d] } }
    foreach ($d in "ne","se","sw","nw") { if ($conn -contains $d) { Draw-Stub $g $diagonal $diagAng[$d] } }
    $g.Dispose()
    return $bmp
}

# A row of test patterns: isolated, straight E-W, corner (E+S), T-junction,
# 4-way cross, straight diagonal (NE+SW), diagonal cross, all-8.
$patterns = @(
    @(),                        # isolated (hub only)
    @("e","w"),                 # straight horizontal
    @("e","s"),                 # L corner
    @("n","s","e"),             # T junction
    @("n","s","e","w"),         # 4-way cross
    @("ne","sw"),               # straight diagonal
    @("ne","se","sw","nw"),     # diagonal X
    @("n","s","e","w","ne","se","sw","nw")  # all 8
)

$cols = $patterns.Count
$scale = 3
$pad = 6
$cellW = $ts * $scale + $pad
$out = New-Object System.Drawing.Bitmap(($cellW * $cols), ($ts * $scale))
$og = [System.Drawing.Graphics]::FromImage($out)
$og.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$og.Clear([System.Drawing.Color]::FromArgb(255, 40, 40, 40))
for ($i = 0; $i -lt $cols; $i++) {
    $tile = Render-Tile $patterns[$i]
    $og.DrawImage($tile, [single]($i * $cellW), 0, [single]($ts * $scale), [single]($ts * $scale))
    $tile.Dispose()
}
$og.Dispose()
$out.Save((Join-Path (Get-Location) "assets\img\working\road_compositing_preview.png"))
$out.Dispose()
$cardinal.Dispose(); $diagonal.Dispose(); $hub.Dispose(); $terrain.Dispose()
Write-Host "Saved assets\img\working\road_compositing_preview.png"
