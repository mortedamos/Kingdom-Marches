<#
.SYNOPSIS
  Runs silence-splitting across many packs unattended, auto-committing
  only the results that pass two independent safety checks, and holding
  everything else back for manual review instead of guessing.

  Built after two real false-positive splits were found by ear (see
  tools/split-sfx-silence.ps1's -MinSilenceMs notes): a file can look
  like a clean multi-take split at one threshold and be flagged wrong.
  Since nobody is listening to all ~850 files as they're processed, this
  script only trusts a result that's cheap to verify mechanically:

.PARAMETER ManifestPath
  Text file, one pack directory per line (blank lines and lines starting
  with # ignored). Each directory is processed non-recursively (its
  top-level *.wav files only), matching split-sfx-silence.ps1's semantics.

.PARAMETER OutputRoot
  Root directory auto-committed files are written under, one subfolder
  per pack (named after the pack's own source folder). Default
  assets/sfx/working.

.PARAMETER ReportPath
  Where the needs-review report is written. Default
  "<OutputRoot>/_needs-review.md".

.PARAMETER MinSilenceMs
  Primary/low silence-gap threshold used for the actual split. Default 300.

.PARAMETER StabilityCheckMs
  Second, higher threshold checked against the primary result. If the
  segment COUNT differs between the two, the file's boundaries are
  threshold-sensitive -- a sign the "silence" is really a pause inside
  one continuous action, not a gap between takes (this is exactly how
  the "Nocked" crossbow false-positive showed up). Default 1500 --
  empirically confirmed safe against a genuine 5-take file that only
  starts merging at 1800ms.

.PARAMETER MinSplitSegmentSec
  A second, independent safety floor: even a threshold-stable split is
  held for review if any resulting segment is shorter than this. Short
  fragments are disproportionately likely to be a truncated piece of a
  longer sound rather than a genuine standalone effect. Default 1.0
  (user-directed, 2026-07-22). Applies only to files that actually get
  split (segments.Count > 1) -- an already-single-take file of any
  length is passed through untouched, not "split," so this floor doesn't
  apply to it.

.PARAMETER SilenceThresholdDb
.PARAMETER MinSegmentMs
.PARAMETER PaddingMs
  Same meaning as in split-sfx-silence.ps1; passed through to both the
  low and high stability-check passes.

.PARAMETER Preview
  Classify and report without writing any files.

.NOTES
  Per-file outcome is exactly one of:
    - single-take   : segments.Count <= 1 at the low threshold -- original
                       file copied as-is.
    - auto-split     : threshold-stable AND every segment >= MinSplitSegmentSec
                       -- split and written.
    - needs-review   : anything else (threshold-unstable, and/or contains a
                       sub-floor segment) -- NOTHING is written for this
                       file; it's only listed in the report with both
                       segment counts and durations so a human can decide.
  Unsupported formats (not 16/24-bit PCM) are listed separately and also
  left untouched.
#>
param(
  [Parameter(Mandatory = $true)] [string]$ManifestPath,
  [string]$OutputRoot = "assets/sfx/working",
  [string]$ReportPath,
  [double]$SilenceThresholdDb = -40,
  [int]$MinSilenceMs = 300,
  [int]$StabilityCheckMs = 1500,
  [int]$MinSegmentMs = 150,
  [int]$PaddingMs = 30,
  [double]$MinSplitSegmentSec = 1.0,
  [switch]$Preview
)

. (Join-Path $PSScriptRoot "lib/wav-silence.ps1")

if (-not $ReportPath) { $ReportPath = Join-Path $OutputRoot "_needs-review.md" }

$packDirs = Get-Content $ManifestPath | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }
if (-not $packDirs) { Write-Warning "No pack directories found in $ManifestPath"; exit 1 }

$stats = [PSCustomObject]@{
  Packs = 0; Files = 0; SingleTake = 0; AutoSplit = 0; AutoSplitFiles = 0; NeedsReview = 0; Unsupported = 0
}
$reviewEntries = New-Object System.Collections.Generic.List[object]
$unsupportedEntries = New-Object System.Collections.Generic.List[object]

foreach ($packDir in $packDirs) {
  if (-not (Test-Path -PathType Container $packDir)) {
    Write-Warning "Pack directory not found, skipping: $packDir"
    continue
  }
  $stats.Packs++
  $packName = Split-Path -Leaf $packDir
  $wavFiles = Get-ChildItem -Path $packDir -Filter *.wav -File
  if (-not $wavFiles) { continue }

  $targetDir = Join-Path $OutputRoot $packName

  foreach ($file in $wavFiles) {
    $stats.Files++
    $wav = $null
    try {
      $wav = Read-WavPcm -Path $file.FullName
    } catch {
      Write-Warning "$($file.Name): failed to read ($($_.Exception.Message)), skipping"
      continue
    }
    if (-not (Test-SupportedWavFormat $wav)) {
      $stats.Unsupported++
      $unsupportedEntries.Add([PSCustomObject]@{ Pack = $packName; File = $file.Name; Bits = $wav.Format.BitsPerSample; AudioFormat = $wav.Format.AudioFormat })
      continue
    }

    $sampleRate = $wav.Format.SampleRate
    $segmentsLow = Get-SilenceSegments -Wav $wav -SilenceThresholdDb $SilenceThresholdDb -MinSilenceMs $MinSilenceMs -MinSegmentMs $MinSegmentMs -PaddingMs $PaddingMs

    if ($segmentsLow.Count -le 1) {
      $stats.SingleTake++
      if (-not $Preview) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        Copy-Item -Path $file.FullName -Destination (Join-Path $targetDir $file.Name) -Force
      }
      continue
    }

    $segmentsHigh = Get-SilenceSegments -Wav $wav -SilenceThresholdDb $SilenceThresholdDb -MinSilenceMs $StabilityCheckMs -MinSegmentMs $MinSegmentMs -PaddingMs $PaddingMs
    $stable = ($segmentsLow.Count -eq $segmentsHigh.Count)
    $durations = $segmentsLow | ForEach-Object { [Math]::Round(($_[1] - $_[0]) / $sampleRate, 2) }
    $shortest = ($durations | Measure-Object -Minimum).Minimum
    $allLongEnough = $shortest -ge $MinSplitSegmentSec

    if ($stable -and $allLongEnough) {
      $stats.AutoSplit++
      $stats.AutoSplitFiles += $segmentsLow.Count
      $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
      if (-not $Preview) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        $channels = $wav.Format.Channels
        $bitsPerSample = $wav.Format.BitsPerSample
        $bytesPerFrame = $channels * ($bitsPerSample / 8)
        $n = 1
        foreach ($seg in $segmentsLow) {
          $startByte = $seg[0] * $bytesPerFrame
          $byteLen = ($seg[1] - $seg[0]) * $bytesPerFrame
          $segData = New-Object byte[] $byteLen
          [System.Array]::Copy($wav.Data, $startByte, $segData, 0, $byteLen)
          $outPath = Join-Path $targetDir ("{0}_{1:D2}.wav" -f $baseName, $n)
          Write-WavPcm -Path $outPath -Channels $channels -SampleRate $sampleRate -BitsPerSample $bitsPerSample -Data $segData
          $n++
        }
      }
    } else {
      $stats.NeedsReview++
      $reasons = New-Object System.Collections.Generic.List[string]
      if (-not $stable) { $reasons.Add("unstable ($($segmentsLow.Count) segments @ ${MinSilenceMs}ms vs $($segmentsHigh.Count) @ ${StabilityCheckMs}ms)") }
      if (-not $allLongEnough) { $reasons.Add("shortest segment $($shortest)s < ${MinSplitSegmentSec}s floor") }
      $reviewEntries.Add([PSCustomObject]@{
        Pack = $packName
        File = $file.Name
        Reasons = ($reasons -join "; ")
        Durations = ($durations -join ", ")
      })
    }
  }
}

if (-not $Preview) {
  New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# SFX split -- needs review")
  $lines.Add("")
  $lines.Add("Nothing below was written to $OutputRoot -- each entry failed the stability check, the >=${MinSplitSegmentSec}s segment floor, or both. Re-run split-sfx-silence.ps1 -Preview on the individual file with a few different -MinSilenceMs values to see what's actually going on before deciding.")
  $lines.Add("")
  $lines.Add("| Pack | File | Reason | Segment durations (s) |")
  $lines.Add("|---|---|---|---|")
  foreach ($e in $reviewEntries) {
    $lines.Add("| $($e.Pack) | $($e.File) | $($e.Reasons) | $($e.Durations) |")
  }
  if ($unsupportedEntries.Count -gt 0) {
    $lines.Add("")
    $lines.Add("## Unsupported format (not 16/24-bit PCM)")
    $lines.Add("")
    $lines.Add("| Pack | File | Bits | AudioFormat |")
    $lines.Add("|---|---|---|---|")
    foreach ($e in $unsupportedEntries) {
      $lines.Add("| $($e.Pack) | $($e.File) | $($e.Bits) | $($e.AudioFormat) |")
    }
  }
  Set-Content -Path $ReportPath -Value $lines -Encoding UTF8
}

Write-Host ""
Write-Host "=== Batch summary ==="
Write-Host "Packs processed:        $($stats.Packs)"
Write-Host "Files processed:        $($stats.Files)"
Write-Host "Single-take (copied):   $($stats.SingleTake)"
Write-Host "Auto-split files:       $($stats.AutoSplit) source files -> $($stats.AutoSplitFiles) output takes"
Write-Host "Needs review (skipped): $($stats.NeedsReview)"
Write-Host "Unsupported format:     $($stats.Unsupported)"
if (-not $Preview) { Write-Host "Review report:          $ReportPath" }
