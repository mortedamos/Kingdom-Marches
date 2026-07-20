<#
.SYNOPSIS
  Reorders a set of already-keyed, same-size animation frames into the
  cyclic sequence that minimizes visual "jump" between consecutive frames
  (including the wrap-around from the last frame back to the first) —
  so e.g. a head-turn animation goes left -> center -> right -> center
  instead of jumping straight from one extreme to the other.

  The engine's currentFrame() (js/ui/sprites.js) just cycles through the
  manifest's frames array in a loop with no interpolation, so the frame
  AFTER the last one is always the first one again — this script treats
  frame ordering as a genuine cycle, not an open sequence, and picks the
  ordering that minimizes total distance around that full loop.

.PARAMETER FramePaths
  Frame PNGs in their original (arbitrary) generation order.

.PARAMETER OutputDir
  Directory to write frame_1.png, frame_2.png, ... in the chosen order.

.EXAMPLE
  .\tools\order-frames.ps1 -FramePaths f1.png,f2.png,f3.png,f4.png -OutputDir ordered
#>

param(
    [Parameter(Mandatory = $true)][string[]]$FramePaths,
    [Parameter(Mandatory = $true)][string]$OutputDir
)

Add-Type -AssemblyName System.Drawing

function Get-Pixels($path) {
    $img = [System.Drawing.Image]::FromFile($path)
    $bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
    $g.Dispose(); $img.Dispose()
    $rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bytes = New-Object byte[] ([Math]::Abs($data.Stride) * $bmp.Height)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
    $bmp.UnlockBits($data)
    $bmp.Dispose()
    return $bytes
}

function Get-PixelDelta($a, $b) {
    $diffSum = 0L; $count = 0
    for ($i = 0; $i -lt $a.Length; $i += 4) {
        if ($a[$i + 3] -gt 10 -or $b[$i + 3] -gt 10) {
            $diffSum += [Math]::Abs([int]$a[$i] - [int]$b[$i]) + [Math]::Abs([int]$a[$i + 1] - [int]$b[$i + 1]) + [Math]::Abs([int]$a[$i + 2] - [int]$b[$i + 2])
            $count++
        }
    }
    if ($count -eq 0) { return 0 }
    return $diffSum / $count
}

# Generates all permutations of a list (recursive).
function Get-Permutations($list) {
    if ($list.Count -le 1) { return , $list }
    $result = @()
    for ($i = 0; $i -lt $list.Count; $i++) {
        # PowerShell's 0..($i-1) is NOT empty when $i=0 -- it's the
        # descending range @(0,-1), which would silently duplicate list
        # elements into $rest and corrupt the recursion. Filter by index
        # explicitly instead of range-slicing to avoid that trap.
        $rest = @()
        for ($k = 0; $k -lt $list.Count; $k++) {
            if ($k -ne $i) { $rest += $list[$k] }
        }
        foreach ($p in Get-Permutations $rest) {
            $result += , (@($list[$i]) + $p)
        }
    }
    return $result
}

$n = $FramePaths.Count
# NOT $FramePaths | ForEach-Object { Get-Pixels $_ } -- PowerShell's pipeline
# flattens each emitted byte[] element by element, so $pixels would end up
# as one giant flat byte list instead of $n separate per-frame buffers.
# An explicit loop with array-append avoids that unrolling.
$pixels = @()
foreach ($fp in $FramePaths) { $pixels += , (Get-Pixels $fp) }

# Pairwise distance matrix.
$dist = New-Object 'double[,]' $n, $n
for ($i = 0; $i -lt $n; $i++) {
    for ($j = $i + 1; $j -lt $n; $j++) {
        $d = Get-PixelDelta $pixels[$i] $pixels[$j]
        $dist[$i, $j] = $d
        $dist[$j, $i] = $d
    }
}

# Fix index 0 as the cycle's start (a cycle has no inherent start, so this
# loses nothing) and brute-force all orderings of the rest -- fine for the
# small frame counts (4, per the style guide default) this is built for.
$rest = 1..($n - 1)
$perms = Get-Permutations $rest

$best = $null
$bestCost = [double]::MaxValue
$originalCost = 0.0
for ($i = 0; $i -lt $n; $i++) {
    $nextI = ($i + 1) % $n
    $originalCost += $dist[$i, $nextI]
}

foreach ($p in $perms) {
    $order = @(0) + $p
    $cost = 0.0
    for ($i = 0; $i -lt $n; $i++) {
        $nextI = ($i + 1) % $n
        $a = $order[$i]
        $b = $order[$nextI]
        $cost += $dist[$a, $b]
    }
    if ($cost -lt $bestCost) {
        $bestCost = $cost
        $best = $order
    }
}

"Original order cyclic cost: $([Math]::Round($originalCost, 2))"
"Best order cyclic cost:     $([Math]::Round($bestCost, 2))"
"Chosen order (0-indexed into input list): $($best -join ', ')"

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }
$outIdx = 0
foreach ($idx in $best) {
    $outIdx++
    $destPath = Join-Path $OutputDir "frame_$outIdx.png"
    Copy-Item $FramePaths[$idx] $destPath -Force
    "  frame_$outIdx.png <- $($FramePaths[$idx])"
}
