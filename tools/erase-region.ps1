<#
.SYNOPSIS
  Removes a stray disconnected object from an already-keyed (real alpha)
  sprite frame via seeded, bounding-box-constrained flood fill. For
  surgically removing a specific defect (e.g. a duplicated prop) without
  regenerating the whole frame, when the defect doesn't touch the parts
  of the image you want to keep.

.PARAMETER InputPath
  The keyed (already-transparent) frame PNG to edit.

.PARAMETER OutputPath
  Where to save the edited result. Can be the same as InputPath.

.PARAMETER SeedX / SeedY
  A pixel clearly inside the stray object to remove, in the frame's
  native pixel coordinates.

.PARAMETER BoxX1 / BoxY1 / BoxX2 / BoxY2
  Bounding box (inclusive) the flood fill is not allowed to leave. Pick
  this to safely exclude anything you want to keep, even if you're not
  100% sure the stray object is fully disconnected from it.

.EXAMPLE
  .\tools\erase-region.ps1 -InputPath frame_4.png -OutputPath frame_4.png -SeedX 15 -SeedY 20 -BoxX1 0 -BoxY1 0 -BoxX2 45 -BoxY2 128
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][int]$SeedX,
    [Parameter(Mandatory = $true)][int]$SeedY,
    [Parameter(Mandatory = $true)][int]$BoxX1,
    [Parameter(Mandatory = $true)][int]$BoxY1,
    [Parameter(Mandatory = $true)][int]$BoxX2,
    [Parameter(Mandatory = $true)][int]$BoxY2
)

Add-Type -AssemblyName System.Drawing

Add-Type -Language CSharp -TypeDefinition @"
using System;

public static class EraseTool
{
    // 8-connected flood fill over alpha>10 pixels, constrained to
    // [boxX1,boxY1]-[boxX2,boxY2] inclusive. Clears filled pixels to
    // fully transparent. Returns count of pixels cleared.
    public static int FloodClear(byte[] buf, int width, int height,
        int seedX, int seedY, int boxX1, int boxY1, int boxX2, int boxY2)
    {
        int idx0 = (seedY * width + seedX) * 4;
        if (buf[idx0 + 3] <= 10) return 0; // seed isn't on anything

        bool[] visited = new bool[width * height];
        int[] stack = new int[width * height];
        int sp = 0;
        stack[sp++] = seedY * width + seedX;
        visited[seedY * width + seedX] = true;
        int cleared = 0;

        while (sp > 0)
        {
            int p = stack[--sp];
            int px = p % width, py = p / width;
            int idx = p * 4;
            buf[idx + 3] = 0;
            cleared++;

            for (int dy = -1; dy <= 1; dy++)
            {
                for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dy == 0) continue;
                    int nx = px + dx, ny = py + dy;
                    if (nx < boxX1 || nx > boxX2 || ny < boxY1 || ny > boxY2) continue;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    int np = ny * width + nx;
                    if (visited[np]) continue;
                    int na = buf[np * 4 + 3];
                    if (na <= 10) continue;
                    visited[np] = true;
                    stack[sp++] = np;
                }
            }
        }
        return cleared;
    }
}
"@

$img = [System.Drawing.Image]::FromFile($InputPath)
$bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, $img.Width, $img.Height)
$g.Dispose()
$img.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$byteCount = [Math]::Abs($data.Stride) * $bmp.Height
$buffer = New-Object byte[] $byteCount
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buffer, 0, $byteCount)

$cleared = [EraseTool]::FloodClear($buffer, $bmp.Width, $bmp.Height, $SeedX, $SeedY, $BoxX1, $BoxY1, $BoxX2, $BoxY2)

[System.Runtime.InteropServices.Marshal]::Copy($buffer, 0, $data.Scan0, $byteCount)
$bmp.UnlockBits($data)

$bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

"Cleared $cleared pixels. Saved $OutputPath"
