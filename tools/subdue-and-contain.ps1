<#
.SYNOPSIS
  Reduces how strongly a terrain tile's motif (e.g. ocean wave crests)
  pops against its base fill, and pulls that motif away from the tile
  edges so it reads as fully contained inside the tile instead of
  crossing/touching the boundary. Pure pixel post-process on already-
  installed art -- no regeneration.

.PARAMETER InputPath
  Source PNG (single frame or multi-frame horizontal sheet).

.PARAMETER OutputPath
  Where to save the result.

.PARAMETER BaseHex
  The tile's flat background/base color ("#RRGGBB") -- everything gets
  blended toward this.

.PARAMETER IntensityFactor
  0-1: uniform blend of every pixel toward BaseHex, reducing the
  motif's overall contrast/prominence. Default 0.

.PARAMETER EdgeMarginPx
  How many pixels in from each edge get progressively forced toward
  BaseHex (full strength right at the edge, fading to no extra pull at
  EdgeMarginPx inward, smoothstep falloff). Default 0 (off).

.PARAMETER FrameWidth
  Width of a single frame. Defaults to image height (square frames).

.EXAMPLE
  .\tools\subdue-and-contain.ps1 -InputPath assets\terrain\ocean_1.png -OutputPath assets\terrain\ocean_1.png -BaseHex "#1E4E6E" -IntensityFactor 0.5 -EdgeMarginPx 14 -FrameWidth 64
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string]$BaseHex,
    [double]$IntensityFactor = 0,
    [int]$EdgeMarginPx = 0,
    [int]$FrameWidth = 0
)

Add-Type -AssemblyName System.Drawing

Add-Type -Language CSharp -TypeDefinition @"
using System;

public static class SubdueTool
{
    public static void ProcessBuffer(byte[] buf, int width, int height, int frameWidth,
        byte baseR, byte baseG, byte baseB,
        double intensityFactor, int edgeMarginPx)
    {
        int numFrames = width / frameWidth;
        for (int f = 0; f < numFrames; f++)
        {
            int fx0 = f * frameWidth;
            for (int y = 0; y < height; y++)
            {
                for (int lx = 0; lx < frameWidth; lx++)
                {
                    int x = fx0 + lx;
                    int idx = (y * width + x) * 4;
                    byte a = buf[idx + 3];
                    if (a == 0) continue;

                    double r = buf[idx + 2], g = buf[idx + 1], b = buf[idx];

                    if (intensityFactor > 0)
                    {
                        r = r + (baseR - r) * intensityFactor;
                        g = g + (baseG - g) * intensityFactor;
                        b = b + (baseB - b) * intensityFactor;
                    }

                    if (edgeMarginPx > 0)
                    {
                        int dx = Math.Min(lx, frameWidth - 1 - lx);
                        int dy = Math.Min(y, height - 1 - y);
                        int edgeDist = Math.Min(dx, dy);
                        double t = Math.Max(0.0, Math.Min(1.0, edgeDist / (double)edgeMarginPx));
                        double smooth = t * t * (3.0 - 2.0 * t);
                        double edgeWeight = 1.0 - smooth;
                        r = r + (baseR - r) * edgeWeight;
                        g = g + (baseG - g) * edgeWeight;
                        b = b + (baseB - b) * edgeWeight;
                    }

                    buf[idx]     = (byte)Math.Round(Math.Max(0, Math.Min(255, b)));
                    buf[idx + 1] = (byte)Math.Round(Math.Max(0, Math.Min(255, g)));
                    buf[idx + 2] = (byte)Math.Round(Math.Max(0, Math.Min(255, r)));
                }
            }
        }
    }
}
"@

$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
$bmp = New-Object System.Drawing.Bitmap($srcImg.Width, $srcImg.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($srcImg, 0, 0, $srcImg.Width, $srcImg.Height)
$g.Dispose()
$srcImg.Dispose()

if ($FrameWidth -le 0) { $FrameWidth = $bmp.Height }

$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$byteCount = [Math]::Abs($data.Stride) * $bmp.Height
$buffer = New-Object byte[] $byteCount
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buffer, 0, $byteCount)

$hex = $BaseHex.TrimStart('#')
$br = [Convert]::ToByte($hex.Substring(0,2), 16)
$bgc = [Convert]::ToByte($hex.Substring(2,2), 16)
$bb = [Convert]::ToByte($hex.Substring(4,2), 16)

[SubdueTool]::ProcessBuffer($buffer, $bmp.Width, $bmp.Height, $FrameWidth, $br, $bgc, $bb, $IntensityFactor, $EdgeMarginPx)

[System.Runtime.InteropServices.Marshal]::Copy($buffer, 0, $data.Scan0, $byteCount)
$bmp.UnlockBits($data)

$outDir = Split-Path -Parent $OutputPath
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$bmp.Save((Join-Path (Get-Location) $OutputPath), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Saved $OutputPath"
