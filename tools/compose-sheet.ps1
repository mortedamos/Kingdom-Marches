<#
.SYNOPSIS
  Composites already-keyed, same-size animation frames into a single
  horizontal sprite-sheet PNG, with an alignment check (per
  doc/art_style_guide.md §7) that flags frames whose subject silhouette
  has drifted in position or size before anything gets composited.

.PARAMETER FramePaths
  Ordered array of frame PNG paths (already chroma-keyed and resized to
  the same dimensions — run tools/chroma-key.ps1 on each first).

.PARAMETER OutputPath
  Where to save the composited sprite sheet.

.PARAMETER MaxShiftPx
  Bounding-box center shift (in pixels, at the frames' native size) beyond
  which a frame is flagged as likely to jitter in-engine. Default 4.
  Checked AFTER auto-recentering (see below), so this now catches scale
  mismatches recentering can't fix, not the plain translation drift it
  used to mostly be catching.

.PARAMETER NoAutoRecenter
  Skip auto-recentering (see below) and composite frames exactly as
  given, like this script originally did. Mainly for reproducing/
  debugging a specific past result.

.EXAMPLE
  .\tools\compose-sheet.ps1 -FramePaths f1.png,f2.png,f3.png,f4.png -OutputPath sheet.png
#>

param(
    [Parameter(Mandatory = $true)][string[]]$FramePaths,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [int]$MaxShiftPx = 4,
    [switch]$NoAutoRecenter
)

Add-Type -AssemblyName System.Drawing

Add-Type -Language CSharp -TypeDefinition @"
using System;
using System.Drawing;

public static class BBoxTool
{
    // Returns [minX, minY, maxX, maxY, pixelCount] of pixels with alpha > 10.
    public static int[] GetBoundingBox(byte[] buf, int width, int height)
    {
        int minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                int idx = (y * width + x) * 4;
                int a = buf[idx + 3];
                if (a > 10)
                {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    count++;
                }
            }
        }
        return new int[] { minX, minY, maxX, maxY, count };
    }
}
"@

function Get-Bbox {
    param([string]$Path)
    $img = [System.Drawing.Image]::FromFile($Path)
    $bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
    $g.Dispose()
    $img.Dispose()

    $rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $byteCount = [Math]::Abs($data.Stride) * $bmp.Height
    $buffer = New-Object byte[] $byteCount
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buffer, 0, $byteCount)
    $bmp.UnlockBits($data)

    $box = [BBoxTool]::GetBoundingBox($buffer, $bmp.Width, $bmp.Height)
    $bmp.Dispose()

    [PSCustomObject]@{
        MinX = $box[0]; MinY = $box[1]; MaxX = $box[2]; MaxY = $box[3]
        CenterX = ($box[0] + $box[2]) / 2.0
        CenterY = ($box[1] + $box[3]) / 2.0
        Width = $box[2] - $box[0]
        Height = $box[3] - $box[1]
        PixelCount = $box[4]
    }
}

$boxes = foreach ($p in $FramePaths) { Get-Bbox -Path $p }
$ref = $boxes[0]

$preReport = for ($i = 0; $i -lt $FramePaths.Count; $i++) {
    $b = $boxes[$i]
    [PSCustomObject]@{
        Frame     = Split-Path $FramePaths[$i] -Leaf
        CenterDX  = [Math]::Round($b.CenterX - $ref.CenterX, 1)
        CenterDY  = [Math]::Round($b.CenterY - $ref.CenterY, 1)
        WidthDiff = $b.Width - $ref.Width
        HeightDiff = $b.Height - $ref.Height
    }
}
"Pre-recenter bounding-box offsets from frame 1:"
$preReport | Format-Table -AutoSize

# Composite: assume all frames share the same dimensions (as produced by
# chroma-key.ps1 -ResizeTo). Horizontal strip, left to right.
$first = [System.Drawing.Image]::FromFile($FramePaths[0])
$frameW = $first.Width
$frameH = $first.Height
$first.Dispose()

$sheetW = $frameW * $FramePaths.Count
$sheet = New-Object System.Drawing.Bitmap($sheetW, $frameH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheet)

$finalReport = for ($i = 0; $i -lt $FramePaths.Count; $i++) {
    $frameImg = [System.Drawing.Image]::FromFile($FramePaths[$i])
    $destX = $i * $frameW

    if (-not $NoAutoRecenter) {
        # Shift this frame's content so its bounding-box center lands on
        # frame 1's -- fixes plain translation drift from the source
        # generation regardless of how well-centered it happened to be.
        # Out-of-bounds pixels from the shift are simply clipped, which is
        # fine given the ~10% padding these frames are generated with.
        $b = $boxes[$i]
        $shiftX = [Math]::Round($ref.CenterX - $b.CenterX)
        $shiftY = [Math]::Round($ref.CenterY - $b.CenterY)
        $g.DrawImage($frameImg, ($destX + $shiftX), $shiftY, $frameW, $frameH)
    } else {
        $g.DrawImageUnscaled($frameImg, $destX, 0)
    }
    $frameImg.Dispose()

    $b = $boxes[$i]
    $dx = if ($NoAutoRecenter) { [Math]::Round($b.CenterX - $ref.CenterX, 1) } else { 0 }
    $dy = if ($NoAutoRecenter) { [Math]::Round($b.CenterY - $ref.CenterY, 1) } else { 0 }
    $dw = $b.Width - $ref.Width
    $dh = $b.Height - $ref.Height
    $flag = if ([Math]::Abs($dx) -gt $MaxShiftPx -or [Math]::Abs($dw) -gt $MaxShiftPx -or [Math]::Abs($dh) -gt $MaxShiftPx) { "SHIFTED/SCALE" } else { "ok" }
    [PSCustomObject]@{
        Frame     = Split-Path $FramePaths[$i] -Leaf
        CenterDX  = $dx
        CenterDY  = $dy
        WidthDiff = $dw
        HeightDiff = $dh
        Status    = $flag
    }
}
$g.Dispose()

if (-not $NoAutoRecenter) { "Auto-recentered each frame to frame 1's bounding-box center. Remaining diffs (scale-only, translation already fixed):" }
$finalReport | Format-Table -AutoSize

$shifted = $finalReport | Where-Object { $_.Status -eq "SHIFTED/SCALE" }
if ($shifted) {
    $msg = if ($NoAutoRecenter) { "position/scale" } else { "scale (auto-recentering only fixes position, not size differences)" }
    Write-Warning "Frame(s) still differ in $msg beyond $MaxShiftPx px from frame 1: $($shifted.Frame -join ', '). Review before shipping -- see doc/art_style_guide.md section 7."
}

$outDir = Split-Path $OutputPath -Parent
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$sheet.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()

$sheetW = $frameW * $FramePaths.Count
"Saved $OutputPath ($($FramePaths.Count) frames, ${frameW}x${frameH} each, ${sheetW}x${frameH} sheet)"
