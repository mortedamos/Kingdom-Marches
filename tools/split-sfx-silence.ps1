<#
.SYNOPSIS
  Splits a WAV file containing multiple sound "takes" back-to-back
  (a common way sound-library packs ship variation sets) into individual
  WAV files, one per take, by detecting silence gaps between them.

  Pure .NET PCM parsing (WAV header + Add-Type C# amplitude scan) -- no
  ffmpeg/sox dependency, matching this project's existing tools/*.ps1
  pattern of bespoke PowerShell media tooling (see chroma-key.ps1). Core
  WAV/silence logic lives in tools/lib/wav-silence.ps1, shared with
  tools/batch-split-sfx.ps1.

.PARAMETER InputPath
  A single .wav file, or a directory of .wav files (top-level only, not
  recursive -- run per-pack so unrelated packs don't get swept in).

.PARAMETER OutputDir
  Directory to write split files into. Defaults to a "split" folder next
  to each input file.

.PARAMETER SilenceThresholdDb
  Peak amplitude below which a sample is considered silence, in dBFS.
  Default -40 (quiet room tone / mic hiss between takes is usually well
  below this; true silence is -inf). Raise toward 0 to be stricter about
  what counts as "silence" (e.g. -30 if takes have audible bleed between
  them), lower toward -60 for a very clean/quiet source.

.PARAMETER MinSilenceMs
  Minimum gap duration to treat as a take boundary, in milliseconds.
  Default 300. A short dip below threshold mid-take (e.g. a transient
  dropout) shorter than this is NOT treated as a boundary.

  IMPORTANT (found empirically, see project notes 2026-07-22): this is
  NOT safe to trust blindly. Some source files use a ~0.3-1s pause as
  part of ONE continuous multi-step action (e.g. a crossbow bolt sliding
  into its rest, then being nocked/drawn/released) rather than as a gap
  between two separate takes -- at this file's default, such a file gets
  wrongly fragmented. Before trusting a split, sweep a few MinSilenceMs
  values with -Preview: a genuine multi-take file's segment COUNT stays
  stable across a wide range (e.g. 300-1500ms); a false-positive
  fragmentation's count changes as the threshold rises, then collapses to
  1 segment once the threshold clears the real internal pause. See
  tools/batch-split-sfx.ps1 for this stability check automated at scale.

.PARAMETER MinSegmentMs
  Segments shorter than this after padding are discarded as noise/clicks
  rather than real takes. Default 150.

.PARAMETER PaddingMs
  Milliseconds of the original (pre-threshold-cut) audio to keep on each
  side of a detected segment, so the attack/tail of a take isn't clipped
  right at the threshold crossing. Default 30.

.PARAMETER Preview
  List what would be split without writing any files.

.EXAMPLE
  ./tools/split-sfx-silence.ps1 -InputPath "assets/sfx/source/.../Eiravaein Works - Nocked" -Preview

.EXAMPLE
  ./tools/split-sfx-silence.ps1 -InputPath "assets/sfx/source/.../some-multitake-file.wav" -OutputDir "assets/sfx/staging/archery"

.NOTES
  16-bit and 24-bit integer PCM WAV are supported (this covers the Sonniss
  GDC bundles, which ship as 24-bit PCM almost throughout). 32-bit/float/
  compressed formats are skipped with a warning rather than silently
  mis-decoded -- re-export to 16 or 24-bit integer PCM first if needed.
#>
param(
  [Parameter(Mandatory = $true)] [string]$InputPath,
  [string]$OutputDir,
  [double]$SilenceThresholdDb = -40,
  [int]$MinSilenceMs = 300,
  [int]$MinSegmentMs = 150,
  [int]$PaddingMs = 30,
  [switch]$Preview
)

. (Join-Path $PSScriptRoot "lib/wav-silence.ps1")

function Split-OneFile {
  param([string]$FilePath)

  $wav = Read-WavPcm -Path $FilePath
  if (-not (Test-SupportedWavFormat $wav)) {
    Write-Warning "$([System.IO.Path]::GetFileName($FilePath)): unsupported format (audioFormat=$($wav.Format.AudioFormat), bits=$($wav.Format.BitsPerSample)) -- only 16/24-bit PCM is supported, skipping"
    return
  }

  $channels = $wav.Format.Channels
  $sampleRate = $wav.Format.SampleRate
  $bitsPerSample = $wav.Format.BitsPerSample
  $bytesPerSample = $bitsPerSample / 8

  $segments = Get-SilenceSegments -Wav $wav -SilenceThresholdDb $SilenceThresholdDb -MinSilenceMs $MinSilenceMs -MinSegmentMs $MinSegmentMs -PaddingMs $PaddingMs

  $name = [System.IO.Path]::GetFileName($FilePath)
  if ($segments.Count -le 1) {
    Write-Host "$name -- $($segments.Count) segment(s) found, likely already a single take, skipping"
    return
  }

  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
  $targetDir = if ($OutputDir) { $OutputDir } else { Join-Path (Split-Path -Parent $FilePath) "split" }

  Write-Host "$name -- $($segments.Count) takes found"
  if (-not $Preview) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }

  $n = 1
  foreach ($seg in $segments) {
    $startFrame = $seg[0]; $endFrame = $seg[1]
    $durationSec = [Math]::Round(($endFrame - $startFrame) / $sampleRate, 2)
    $outPath = Join-Path $targetDir ("{0}_{1:D2}.wav" -f $baseName, $n)
    if ($Preview) {
      Write-Host "  [$n] $($durationSec)s -> $outPath"
    } else {
      $bytesPerFrame = $channels * $bytesPerSample
      $startByte = $startFrame * $bytesPerFrame
      $byteLen = ($endFrame - $startFrame) * $bytesPerFrame
      $segData = New-Object byte[] $byteLen
      [System.Array]::Copy($wav.Data, $startByte, $segData, 0, $byteLen)
      Write-WavPcm -Path $outPath -Channels $channels -SampleRate $sampleRate -BitsPerSample $bitsPerSample -Data $segData
      Write-Host "  [$n] $($durationSec)s -> $outPath"
    }
    $n++
  }
}

$targets = if (Test-Path -PathType Container $InputPath) {
  Get-ChildItem -Path $InputPath -Filter *.wav -File
} else {
  Get-Item -Path $InputPath
}

if (-not $targets) {
  Write-Warning "No .wav files found at $InputPath"
  exit 1
}

foreach ($file in $targets) {
  Split-OneFile -FilePath $file.FullName
}
