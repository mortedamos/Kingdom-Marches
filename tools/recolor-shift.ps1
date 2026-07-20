<#
.SYNOPSIS
  Palette-harmonization color grade for already-installed terrain art.
  Shifts each pixel's Hue/Saturation partway toward a target color (or
  toward white/desaturated, for a "whiten" pass) while leaving Lightness
  untouched -- this preserves all existing shading, gradients, and
  outlines exactly, only recoloring the underlying hue family. No
  regeneration needed.

.PARAMETER InputPath
  Source PNG (single frame or multi-frame horizontal sheet -- operates
  on every pixel uniformly, frame boundaries don't matter for this).

.PARAMETER OutputPath
  Where to save the result.

.PARAMETER TargetHex
  Optional "#RRGGBB" color to pull Hue/Saturation toward.

.PARAMETER HueFactor
  0-1: how far to pull each pixel's Hue toward TargetHex's Hue. Default 0.

.PARAMETER SatFactor
  0-1: how far to pull each pixel's Saturation toward TargetHex's
  Saturation. Default 0.

.PARAMETER LightnessFactor
  0-1: how far to pull each pixel's Lightness toward TargetHex's
  Lightness (distinct from WhitenFactor, which always pulls toward
  pure white regardless of TargetHex). Default 0.

.PARAMETER WhitenFactor
  0-1: how far to pull each pixel's Lightness toward white (1.0).
  Default 0.

.PARAMETER DesatFactor
  0-1: how far to pull each pixel's Saturation toward 0, independent of
  any target color. Default 0.

.PARAMETER ProtectExtremes
  If set (default true), fades all of the above to zero effect as pixel
  Lightness approaches 0 (black outlines) or 1 (white highlights), so
  linework and highlights stay neutral instead of picking up a tint.

.EXAMPLE
  .\tools\recolor-shift.ps1 -InputPath assets\terrain\hills_1.png -OutputPath assets\terrain\hills_1.png -TargetHex "#6EA54A" -HueFactor 0.3 -SatFactor 0.3
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$TargetHex,
    [double]$HueFactor = 0,
    [double]$SatFactor = 0,
    [double]$LightnessFactor = 0,
    [double]$WhitenFactor = 0,
    [double]$DesatFactor = 0,
    [bool]$ProtectExtremes = $true,
    # Optional source-hue gate: only pixels whose CURRENT hue falls within
    # this circular range (degrees, wraps past 360) are affected at all --
    # everything outside it (plus a soft feather band at the edges) is left
    # completely untouched. Lets you recolor e.g. "just the red leaves"
    # without touching brown bark elsewhere in the same image. Omit both
    # (leave at -1) to affect every pixel as before.
    [double]$SourceHueMin = -1,
    [double]$SourceHueMax = -1,
    [double]$HueFeather = 15
)

Add-Type -AssemblyName System.Drawing

Add-Type -Language CSharp -TypeDefinition @"
using System;

public static class RecolorTool
{
    public static void RgbToHsl(byte r, byte g, byte b, out double h, out double s, out double l)
    {
        double rd = r / 255.0, gd = g / 255.0, bd = b / 255.0;
        double max = Math.Max(rd, Math.Max(gd, bd));
        double min = Math.Min(rd, Math.Min(gd, bd));
        double delta = max - min;
        l = (max + min) / 2.0;
        if (delta < 1e-9) { h = 0; s = 0; return; }
        s = l < 0.5 ? delta / (max + min) : delta / (2.0 - max - min);
        if (max == rd) h = 60.0 * (((gd - bd) / delta) % 6.0);
        else if (max == gd) h = 60.0 * (((bd - rd) / delta) + 2.0);
        else h = 60.0 * (((rd - gd) / delta) + 4.0);
        if (h < 0) h += 360.0;
    }

    static double HueToRgb(double p, double q, double t)
    {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
        if (t < 1.0/2.0) return q;
        if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
        return p;
    }

    public static void HslToRgb(double h, double s, double l, out byte r, out byte g, out byte b)
    {
        double rd, gd, bd;
        if (s < 1e-9) { rd = gd = bd = l; }
        else
        {
            double q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            double p = 2 * l - q;
            double hn = h / 360.0;
            rd = HueToRgb(p, q, hn + 1.0/3.0);
            gd = HueToRgb(p, q, hn);
            bd = HueToRgb(p, q, hn - 1.0/3.0);
        }
        r = (byte)Math.Round(Math.Max(0, Math.Min(1, rd)) * 255.0);
        g = (byte)Math.Round(Math.Max(0, Math.Min(1, gd)) * 255.0);
        b = (byte)Math.Round(Math.Max(0, Math.Min(1, bd)) * 255.0);
    }

    static double CircularLerp(double from, double to, double t)
    {
        double diff = ((to - from + 540.0) % 360.0) - 180.0;
        double result = from + diff * t;
        result = result % 360.0;
        if (result < 0) result += 360.0;
        return result;
    }

    // Weight in [0,1] for whether hue h falls inside the circular arc from
    // sourceMin to sourceMax (going clockwise/increasing), with a soft
    // feather band of `feather` degrees just outside each edge so the cutoff
    // isn't a hard, speckly line. 1.0 = fully inside, 0.0 = fully outside.
    static double HueGateWeight(double h, double sourceMin, double sourceMax, double feather)
    {
        double span = ((sourceMax - sourceMin) % 360.0 + 360.0) % 360.0;
        if (span < 1e-9) return 1.0; // degenerate range (min==max) = no restriction
        double pos = ((h - sourceMin) % 360.0 + 360.0) % 360.0;
        if (pos <= span) return 1.0;
        double outsideDist = Math.Min(pos - span, 360.0 - pos);
        if (feather < 1e-9) return 0.0;
        return Math.Max(0.0, 1.0 - outsideDist / feather);
    }

    public static void ProcessBuffer(byte[] buf, int width, int height,
        bool hasTarget, double targetH, double targetS, double targetL,
        double hueFactor, double satFactor, double lightnessFactor, double whitenFactor, double desatFactor,
        bool protectExtremes, bool hasHueGate, double sourceHueMin, double sourceHueMax, double hueFeather)
    {
        int count = width * height;
        for (int i = 0; i < count; i++)
        {
            int idx = i * 4;
            byte bB = buf[idx]; byte bG = buf[idx+1]; byte bR = buf[idx+2]; byte bA = buf[idx+3];
            if (bA == 0) continue;

            double h, s, l;
            RgbToHsl(bR, bG, bB, out h, out s, out l);

            double weight = 1.0;
            if (protectExtremes)
            {
                double lowEdge = Math.Min(1.0, l / 0.15);
                double highEdge = Math.Min(1.0, (1.0 - l) / 0.15);
                weight = Math.Max(0.0, Math.Min(lowEdge, highEdge));
            }
            if (hasHueGate)
            {
                weight *= HueGateWeight(h, sourceHueMin, sourceHueMax, hueFeather);
                if (weight <= 0.0) continue; // untouched pixel, skip entirely
            }

            double newH = h, newS = s, newL = l;
            if (hasTarget && hueFactor > 0)
            {
                // Near-gray pixels (s close to 0) have an unstable/meaningless
                // Hue -- tiny per-pixel RGB noise can send it anywhere on the
                // wheel. Blending a fixed fraction of that noise into the
                // target produces visible color speckle. Instead, scale the
                // effective pull toward 1.0 (fully replace with target Hue)
                // as source Saturation drops toward 0, so low-confidence Hues
                // get overridden cleanly instead of partially blended.
                double satConfidence = Math.Max(0.0, Math.Min(1.0, (s - 0.03) / (0.10 - 0.03)));
                double effectiveHueFactor = hueFactor + (1.0 - hueFactor) * (1.0 - satConfidence);
                newH = CircularLerp(h, targetH, effectiveHueFactor * weight);
            }
            if (hasTarget && satFactor > 0) newS = s + (targetS - s) * (satFactor * weight);
            if (hasTarget && lightnessFactor > 0) newL = l + (targetL - l) * (lightnessFactor * weight);
            if (desatFactor > 0) newS = newS + (0 - newS) * (desatFactor * weight);
            if (whitenFactor > 0) newL = newL + (1.0 - newL) * (whitenFactor * weight);

            byte nr, ng, nb;
            HslToRgb(newH, Math.Max(0, Math.Min(1, newS)), Math.Max(0, Math.Min(1, newL)), out nr, out ng, out nb);
            buf[idx] = nb; buf[idx+1] = ng; buf[idx+2] = nr; buf[idx+3] = bA;
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

$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$byteCount = [Math]::Abs($data.Stride) * $bmp.Height
$buffer = New-Object byte[] $byteCount
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buffer, 0, $byteCount)

$hasTarget = $false
$targetH = 0.0
$targetS = 0.0
$targetL = 0.0
if ($TargetHex) {
    $hex = $TargetHex.TrimStart('#')
    $tr = [Convert]::ToByte($hex.Substring(0,2), 16)
    $tg = [Convert]::ToByte($hex.Substring(2,2), 16)
    $tb = [Convert]::ToByte($hex.Substring(4,2), 16)
    $th = 0.0; $ts = 0.0; $tl = 0.0
    [RecolorTool]::RgbToHsl($tr, $tg, $tb, [ref]$th, [ref]$ts, [ref]$tl)
    $hasTarget = $true
    $targetH = $th
    $targetS = $ts
    $targetL = $tl
}

$hasHueGate = ($SourceHueMin -ge 0 -and $SourceHueMax -ge 0)
[RecolorTool]::ProcessBuffer($buffer, $bmp.Width, $bmp.Height, $hasTarget, $targetH, $targetS, $targetL, $HueFactor, $SatFactor, $LightnessFactor, $WhitenFactor, $DesatFactor, $ProtectExtremes, $hasHueGate, $SourceHueMin, $SourceHueMax, $HueFeather)

[System.Runtime.InteropServices.Marshal]::Copy($buffer, 0, $data.Scan0, $byteCount)
$bmp.UnlockBits($data)

$outDir = Split-Path -Parent $OutputPath
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$bmp.Save([System.IO.Path]::GetFullPath($OutputPath), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Saved $OutputPath"
