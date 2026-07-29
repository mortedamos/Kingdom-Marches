<#
.SYNOPSIS
  Chroma-keys a flat-magenta-background Gemini generation into a real
  transparent PNG, strips stray disconnected artifacts (e.g. Gemini's
  recurring sparkle decoration), and optionally resizes to a target size.

  See doc/art_style_guide.md sections 3 and 8 for why this exists: Gemini
  doesn't give clean alpha transparency or honor requested output sizes,
  and reliably adds small stray decorations outside the main subject.

.PARAMETER InputPath
  A single PNG file, or a directory of PNGs to process.

.PARAMETER OutputDir
  Directory to write processed PNGs into. Defaults to a "keyed" folder
  next to the input.

.PARAMETER ResizeTo
  If set, resizes the keyed result to ResizeTo x ResizeTo (square) as the
  final step, matching the target asset spec from the style guide.

.PARAMETER ResizeWidth
.PARAMETER ResizeHeight
  Non-square alternative to -ResizeTo -- set both to resize to an exact
  WidthxHeight instead of a square (e.g. 128x256 for the portrait City
  tier canvas, see art style guide §12). Takes priority over -ResizeTo
  when both are set.

.PARAMETER ThresholdLow
  Magenta-amount below which a pixel stays fully opaque. Default 50.

.PARAMETER ThresholdHigh
  Magenta-amount above which a pixel becomes fully transparent. Default 120.
  Between Low and High, alpha falls off linearly (soft edge, no hard ring).

.PARAMETER SpillSlack
  How much R/B may exceed G before spill suppression kicks in, applied only
  to partial-alpha edge pixels (never to fully-opaque interior pixels, so
  legitimate warm colors like the orc's red accent are untouched). Default 30.

.PARAMETER MinComponentFraction
  Connected components smaller than this fraction of the largest component's
  pixel count are discarded as stray artifacts. Default 0.05 (5%).

.PARAMETER BorderClearPx
  After resizing, force this many pixels around the outer edge of the
  frame to fully transparent. Confirmed necessary in practice: GDI+'s
  HighQualityBicubic resize samples slightly outside the source rect near
  edges, pulling faint magenta/off-white discoloration from the
  chroma-keyed edge's partial-alpha falloff band into an otherwise-solid
  near-opaque 1px border line. Safe at the default framing spec (~10%
  padding means real content never reaches the outer edge). Default 2,
  only applied when -ResizeTo is set (the artifact is a resize-interpolation
  side effect, not present in unresized output).

.PARAMETER SeamlessEdges
  For edge-to-edge fill tiles only (terrain, never units): sets the
  bicubic resize's sampling wrap mode to mirror-tile (TileFlipXY) instead
  of the GDI+ default, which otherwise blends in a sliver of transparent/
  undefined edge data when sampling just past the source rect. That sliver
  is invisible on a single tile but becomes a faint but real seam once
  identical tiles are placed edge-to-edge in the game (confirmed via
  tools/tile-preview.ps1 on desert and tundra). Do not combine with
  -BorderClearPx > 0 (that clears to transparent, which is wrong for an
  opaque terrain fill).

.PARAMETER LowAlphaSnapThreshold
  After resizing, any pixel with alpha in (0, LowAlphaSnapThreshold] is
  snapped fully transparent. HighQualityBicubic resize blends a keyed-out
  (alpha=0) magenta pixel's uncorrected RGB into the subject's own
  silhouette edge, producing near-invisible pixels (often alpha 3-6) that
  still carry magenta tint -- confirmed directly on Orc city tier 1
  (2026-07-21). BorderClearPx only cleans the outer canvas edge; this
  cleans the same contamination wherever it occurs, including interior
  edges around the subject. Default 12, only applied when resizing (the
  contamination is a resize artifact, not present in the unresized
  chroma-keyed buffer). Set to 0 to disable.

.EXAMPLE
  .\tools\chroma-key.ps1 -InputPath assets\img\test -ResizeTo 128
#>

param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [string]$OutputDir,
    [int]$ResizeTo = 0,
    [int]$ResizeWidth = 0,
    [int]$ResizeHeight = 0,
    [int]$ThresholdLow = 50,
    [int]$ThresholdHigh = 120,
    [int]$SpillSlack = 30,
    [double]$MinComponentFraction = 0.05,
    [int]$MinComponentAbsolute = 40,
    [int]$BorderClearPx = 2,
    [switch]$SeamlessEdges,
    [int]$LowAlphaSnapThreshold = 12
)

Add-Type -AssemblyName System.Drawing

Add-Type -Language CSharp -TypeDefinition @"
using System;

public static class ChromaKeyTool
{
    // buf is BGRA (System.Drawing LockBits byte order for Format32bppArgb).
    public static void ProcessBuffer(byte[] buf, int width, int height,
        int thresholdLow, int thresholdHigh, int spillSlack)
    {
        int n = width * height;
        for (int i = 0; i < n; i++)
        {
            int idx = i * 4;
            int b = buf[idx + 0];
            int g = buf[idx + 1];
            int r = buf[idx + 2];

            int magentaAmount = ((r + b) / 2) - g;
            if (magentaAmount < 0) magentaAmount = 0;

            int alpha;
            if (magentaAmount <= thresholdLow) alpha = 255;
            else if (magentaAmount >= thresholdHigh) alpha = 0;
            else
            {
                double t = (double)(thresholdHigh - magentaAmount) / (thresholdHigh - thresholdLow);
                alpha = (int)Math.Round(t * 255.0);
            }

            if (alpha > 0 && alpha < 255)
            {
                int newR = r, newB = b;
                int excessR = r - g;
                if (excessR > spillSlack) newR = g + spillSlack;
                int excessB = b - g;
                if (excessB > spillSlack) newB = g + spillSlack;
                if (newR < 0) newR = 0; if (newR > 255) newR = 255;
                if (newB < 0) newB = 0; if (newB > 255) newB = 255;
                buf[idx + 2] = (byte)newR;
                buf[idx + 0] = (byte)newB;
            }
            buf[idx + 3] = (byte)alpha;
        }
    }

    // 8-connected component labeling over pixels with alpha > alphaThreshold.
    public static int[] ConnectedComponents(byte[] buf, int width, int height, int alphaThreshold, out int numComponents)
    {
        int n = width * height;
        int[] labels = new int[n];
        int currentLabel = 0;
        int[] stack = new int[n];

        for (int start = 0; start < n; start++)
        {
            if (labels[start] != 0) continue;
            int a0 = buf[start * 4 + 3];
            if (a0 <= alphaThreshold) { labels[start] = -1; continue; }

            currentLabel++;
            int sp = 0;
            stack[sp++] = start;
            labels[start] = currentLabel;

            while (sp > 0)
            {
                int p = stack[--sp];
                int px = p % width, py = p / width;
                for (int dy = -1; dy <= 1; dy++)
                {
                    for (int dx = -1; dx <= 1; dx++)
                    {
                        if (dx == 0 && dy == 0) continue;
                        int nx = px + dx, ny = py + dy;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                        int np = ny * width + nx;
                        if (labels[np] != 0) continue;
                        int na = buf[np * 4 + 3];
                        if (na <= alphaThreshold) { labels[np] = -1; continue; }
                        labels[np] = currentLabel;
                        stack[sp++] = np;
                    }
                }
            }
        }
        numComponents = currentLabel;
        return labels;
    }

    public static int[] ComponentSizes(int[] labels, int numComponents)
    {
        int[] sizes = new int[numComponents + 1];
        for (int i = 0; i < labels.Length; i++)
        {
            int l = labels[i];
            if (l > 0) sizes[l]++;
        }
        return sizes;
    }

    public static int ClearSmallComponents(byte[] buf, int[] labels, int[] sizes, int minKeepSize)
    {
        int cleared = 0;
        for (int i = 0; i < labels.Length; i++)
        {
            int l = labels[i];
            if (l > 0 && sizes[l] < minKeepSize)
            {
                buf[i * 4 + 3] = 0;
                cleared++;
            }
        }
        return cleared;
    }

    // Forces the outer border ring (borderPx wide) to fully transparent --
    // cleans up resize-interpolation edge artifacts (see BorderClearPx doc).
    public static void ClearBorder(byte[] buf, int width, int height, int borderPx)
    {
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                bool onBorder = x < borderPx || x >= width - borderPx || y < borderPx || y >= height - borderPx;
                if (onBorder) buf[(y * width + x) * 4 + 3] = 0;
            }
        }
    }

    // BorderClearPx only cleans the outer canvas edge. HighQualityBicubic
    // resize introduces the same kind of contamination at the SUBJECT's own
    // silhouette edge, anywhere alpha=0 magenta meets alpha=255 subject --
    // ProcessBuffer never spill-corrects fully-keyed (alpha=0) pixels, so
    // their raw magenta RGB is still sitting there for the resize's
    // interpolation to blend into a new low-but-nonzero-alpha pixel at the
    // boundary. Confirmed directly (2026-07-21): pixels like R=255 G=61
    // B=255 at alpha=3-6 survive resize even with correct thresholds,
    // since alpha=3 is far too faint to be caught by the alpha<=thresholdLow
    // opaque branch and the magenta tint was never suppressed pre-resize.
    // Snapping near-zero alpha fully transparent removes the contaminated
    // color with no visible cost (these pixels were already almost
    // invisible) instead of letting it potentially show up as a faint
    // magenta fringe if something later composites without respecting
    // premultiplied alpha.
    public static int SnapLowAlpha(byte[] buf, int width, int height, int alphaSnapThreshold)
    {
        int snapped = 0;
        int n = width * height;
        for (int i = 0; i < n; i++)
        {
            int idx = i * 4;
            if (buf[idx + 3] > 0 && buf[idx + 3] <= alphaSnapThreshold)
            {
                buf[idx + 3] = 0;
                snapped++;
            }
        }
        return snapped;
    }
}
"@

function Invoke-ChromaKeyOnFile {
    param(
        [string]$SrcPath,
        [string]$DestPath
    )

    $srcImg = [System.Drawing.Image]::FromFile($SrcPath)
    $bmp = New-Object System.Drawing.Bitmap($srcImg.Width, $srcImg.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($srcImg, 0, 0, $srcImg.Width, $srcImg.Height)
    $g.Dispose()
    $srcImg.Dispose()

    $rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
    $bmpData = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    $byteCount = [Math]::Abs($bmpData.Stride) * $bmp.Height
    $buffer = New-Object byte[] $byteCount
    [System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $buffer, 0, $byteCount)

    [ChromaKeyTool]::ProcessBuffer($buffer, $bmp.Width, $bmp.Height, $ThresholdLow, $ThresholdHigh, $SpillSlack)

    $numComponents = 0
    $labels = [ChromaKeyTool]::ConnectedComponents($buffer, $bmp.Width, $bmp.Height, 10, [ref]$numComponents)
    $sizes = [ChromaKeyTool]::ComponentSizes($labels, $numComponents)

    $maxSize = 0
    for ($i = 1; $i -le $numComponents; $i++) { if ($sizes[$i] -gt $maxSize) { $maxSize = $sizes[$i] } }
    $minKeep = [Math]::Max($MinComponentAbsolute, [int]($maxSize * $MinComponentFraction))
    $cleared = [ChromaKeyTool]::ClearSmallComponents($buffer, $labels, $sizes, $minKeep)

    [System.Runtime.InteropServices.Marshal]::Copy($buffer, 0, $bmpData.Scan0, $byteCount)
    $bmp.UnlockBits($bmpData)

    $strayComponents = ($sizes[1..$numComponents] | Where-Object { $_ -lt $minKeep -and $_ -gt 0 }).Count

    $targetW = 0; $targetH = 0
    $snappedCount = 0
    if ($ResizeWidth -gt 0 -and $ResizeHeight -gt 0) { $targetW = $ResizeWidth; $targetH = $ResizeHeight }
    elseif ($ResizeTo -gt 0) { $targetW = $ResizeTo; $targetH = $ResizeTo }

    $final = $bmp
    if ($targetW -gt 0) {
        $resized = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $rg = [System.Drawing.Graphics]::FromImage($resized)
        $rg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $rg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $rg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        if ($SeamlessEdges) {
            $ia = New-Object System.Drawing.Imaging.ImageAttributes
            $ia.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $destRect = New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH)
            $rg.DrawImage($bmp, $destRect, 0, 0, $bmp.Width, $bmp.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)
            $ia.Dispose()
        } else {
            $rg.DrawImage($bmp, 0, 0, $targetW, $targetH)
        }
        $rg.Dispose()
        $bmp.Dispose()
        $final = $resized

        if ($LowAlphaSnapThreshold -gt 0) {
            $sRect = New-Object System.Drawing.Rectangle(0, 0, $final.Width, $final.Height)
            $sData = $final.LockBits($sRect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $sByteCount = [Math]::Abs($sData.Stride) * $final.Height
            $sBuffer = New-Object byte[] $sByteCount
            [System.Runtime.InteropServices.Marshal]::Copy($sData.Scan0, $sBuffer, 0, $sByteCount)
            $snappedCount = [ChromaKeyTool]::SnapLowAlpha($sBuffer, $final.Width, $final.Height, $LowAlphaSnapThreshold)
            [System.Runtime.InteropServices.Marshal]::Copy($sBuffer, 0, $sData.Scan0, $sByteCount)
            $final.UnlockBits($sData)
        }

        if ($BorderClearPx -gt 0) {
            $rRect = New-Object System.Drawing.Rectangle(0, 0, $final.Width, $final.Height)
            $rData = $final.LockBits($rRect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $rByteCount = [Math]::Abs($rData.Stride) * $final.Height
            $rBuffer = New-Object byte[] $rByteCount
            [System.Runtime.InteropServices.Marshal]::Copy($rData.Scan0, $rBuffer, 0, $rByteCount)
            [ChromaKeyTool]::ClearBorder($rBuffer, $final.Width, $final.Height, $BorderClearPx)
            [System.Runtime.InteropServices.Marshal]::Copy($rBuffer, 0, $rData.Scan0, $rByteCount)
            $final.UnlockBits($rData)
        }
    }

    $final.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $final.Dispose()

    [PSCustomObject]@{
        File             = Split-Path $SrcPath -Leaf
        Components       = $numComponents
        StrayRemoved     = $strayComponents
        PixelsCleared    = $cleared
        LargestComponent = $maxSize
        LowAlphaSnapped  = $snappedCount
        Output           = $DestPath
    }
}

if (Test-Path $InputPath -PathType Container) {
    $files = Get-ChildItem -Path $InputPath -Filter *.png -File
    if (-not $OutputDir) { $OutputDir = Join-Path $InputPath "keyed" }
} else {
    $files = @(Get-Item $InputPath)
    if (-not $OutputDir) { $OutputDir = Join-Path (Split-Path $InputPath -Parent) "keyed" }
}

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }

$results = foreach ($f in $files) {
    $destPath = Join-Path $OutputDir $f.Name
    Invoke-ChromaKeyOnFile -SrcPath $f.FullName -DestPath $destPath
}

$results | Format-Table -AutoSize
