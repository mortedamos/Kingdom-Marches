<#
  Shared WAV I/O + silence-detection core, dot-sourced by
  tools/split-sfx-silence.ps1 (single file/dir CLI) and
  tools/batch-split-sfx.ps1 (multi-pack batch driver), so both stay on
  the exact same tested logic instead of drifting apart. Has no param
  block and does nothing on its own -- it's a library, not an entry point.
#>

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;

public static class SilenceSplitter
{
    // data: raw interleaved PCM bytes, any of the supported bit depths.
    // "Frame" = one sample instant across all channels.
    public static bool[] DetectSilentFrames(byte[] data, int channels, int bitsPerSample, double thresholdLinear)
    {
        int bytesPerSample = bitsPerSample / 8;
        int bytesPerFrame = bytesPerSample * channels;
        int frameCount = data.Length / bytesPerFrame;
        double maxVal = Math.Pow(2, bitsPerSample - 1) - 1;
        var isSilentFrame = new bool[frameCount];
        for (int f = 0; f < frameCount; f++)
        {
            int maxAbs = 0;
            int frameBase = f * bytesPerFrame;
            for (int c = 0; c < channels; c++)
            {
                int sampleBase = frameBase + c * bytesPerSample;
                int v;
                if (bitsPerSample == 16)
                {
                    v = (short)(data[sampleBase] | (data[sampleBase + 1] << 8));
                }
                else if (bitsPerSample == 24)
                {
                    int raw = data[sampleBase] | (data[sampleBase + 1] << 8) | (data[sampleBase + 2] << 16);
                    if ((raw & 0x800000) != 0) raw |= unchecked((int)0xFF000000); // sign-extend to 32-bit
                    v = raw;
                }
                else
                {
                    throw new NotSupportedException("Unsupported bitsPerSample: " + bitsPerSample);
                }
                int av = Math.Abs(v);
                if (av > maxAbs) maxAbs = av;
            }
            isSilentFrame[f] = (maxAbs / maxVal) < thresholdLinear;
        }
        return isSilentFrame;
    }

    public static List<int[]> FindSegments(bool[] isSilentFrame, int minSilenceFrames, int minSegmentFrames, int paddingFrames)
    {
        int frameCount = isSilentFrame.Length;
        var rawSegments = new List<int[]>();
        int i = 0;
        while (i < frameCount)
        {
            if (isSilentFrame[i]) { i++; continue; }
            int start = i;
            int cursor = i;
            int end = frameCount;
            while (cursor < frameCount)
            {
                if (!isSilentFrame[cursor]) { cursor++; continue; }
                int silenceStart = cursor;
                while (cursor < frameCount && isSilentFrame[cursor]) cursor++;
                if (cursor - silenceStart >= minSilenceFrames)
                {
                    // Long-enough gap: this take ends where the silence started,
                    // not after it -- otherwise the trailing silence gets bundled
                    // into the segment instead of separating it from the next one.
                    end = silenceStart;
                    break;
                }
                // Short dip below threshold mid-take (not a real boundary) --
                // cursor is already past it, keep scanning for a real gap.
            }
            rawSegments.Add(new int[] { start, end });
            i = (end == frameCount) ? frameCount : cursor;
        }

        var result = new List<int[]>();
        foreach (var seg in rawSegments)
        {
            int s = Math.Max(0, seg[0] - paddingFrames);
            int e = Math.Min(frameCount, seg[1] + paddingFrames);
            if (e - s >= minSegmentFrames) result.Add(new int[] { s, e });
        }
        return result;
    }
}
"@

function Read-WavPcm {
  param([string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $br = New-Object System.IO.BinaryReader($stream)
    if ([System.Text.Encoding]::ASCII.GetString($br.ReadBytes(4)) -ne "RIFF") { throw "Not a RIFF file: $Path" }
    [void]$br.ReadUInt32()
    if ([System.Text.Encoding]::ASCII.GetString($br.ReadBytes(4)) -ne "WAVE") { throw "Not a WAVE file: $Path" }

    $fmt = $null
    $dataBytes = $null
    while ($stream.Position -lt $stream.Length) {
      $chunkId = [System.Text.Encoding]::ASCII.GetString($br.ReadBytes(4))
      $chunkSize = $br.ReadUInt32()
      if ($chunkId -eq "fmt ") {
        $audioFormat = $br.ReadUInt16()
        $channels = $br.ReadUInt16()
        $sampleRate = $br.ReadUInt32()
        [void]$br.ReadUInt32()
        [void]$br.ReadUInt16()
        $bitsPerSample = $br.ReadUInt16()
        $extra = $chunkSize - 16
        if ($extra -gt 0) { [void]$br.ReadBytes($extra) }
        $fmt = [PSCustomObject]@{ AudioFormat = $audioFormat; Channels = $channels; SampleRate = $sampleRate; BitsPerSample = $bitsPerSample }
      } elseif ($chunkId -eq "data") {
        $dataBytes = $br.ReadBytes($chunkSize)
      } else {
        [void]$br.ReadBytes($chunkSize)
      }
      if (($chunkSize % 2) -eq 1 -and $stream.Position -lt $stream.Length) { [void]$br.ReadByte() }
    }
    if (-not $fmt -or -not $dataBytes) { throw "Missing fmt or data chunk: $Path" }
    return [PSCustomObject]@{ Format = $fmt; Data = $dataBytes }
  } finally {
    $stream.Dispose()
  }
}

function Write-WavPcm {
  param([string]$Path, [int]$Channels, [int]$SampleRate, [int]$BitsPerSample, [byte[]]$Data)
  $bytesPerSample = $BitsPerSample / 8
  $byteRate = $SampleRate * $Channels * $bytesPerSample
  $blockAlign = $Channels * $bytesPerSample
  $stream = [System.IO.File]::Create($Path)
  try {
    $bw = New-Object System.IO.BinaryWriter($stream)
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
    $bw.Write([uint32](36 + $Data.Length))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
    $bw.Write([uint32]16)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$Channels)
    $bw.Write([uint32]$SampleRate)
    $bw.Write([uint32]$byteRate)
    $bw.Write([uint16]$blockAlign)
    $bw.Write([uint16]$BitsPerSample)
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
    $bw.Write([uint32]$Data.Length)
    $bw.Write($Data)
  } finally {
    $stream.Dispose()
  }
}

# Runs the silence-segmentation at a given MinSilenceMs and returns the
# frame-index segments, without writing anything -- shared core used by
# both the interactive single-file tool and the batch stability check.
function Get-SilenceSegments {
  param(
    [Parameter(Mandatory = $true)] $Wav, # object from Read-WavPcm
    [Parameter(Mandatory = $true)] [double]$SilenceThresholdDb,
    [Parameter(Mandatory = $true)] [int]$MinSilenceMs,
    [Parameter(Mandatory = $true)] [int]$MinSegmentMs,
    [Parameter(Mandatory = $true)] [int]$PaddingMs
  )
  $sampleRate = $Wav.Format.SampleRate
  $thresholdLinear = [Math]::Pow(10, $SilenceThresholdDb / 20)
  $minSilenceFrames = [int]($MinSilenceMs * $sampleRate / 1000)
  $minSegmentFrames = [int]($MinSegmentMs * $sampleRate / 1000)
  $paddingFrames = [int]($PaddingMs * $sampleRate / 1000)
  $isSilentFrame = [SilenceSplitter]::DetectSilentFrames($Wav.Data, $Wav.Format.Channels, $Wav.Format.BitsPerSample, $thresholdLinear)
  $result = [SilenceSplitter]::FindSegments($isSilentFrame, $minSilenceFrames, $minSegmentFrames, $paddingFrames)
  # The unary comma wraps $result so PowerShell's pipeline output only
  # unrolls ONE level (List<int[]> -> a sequence of int[] elements) instead
  # of two (List<int[]> -> int[] -> individual ints) -- without it, the
  # caller's `$segments = Get-SilenceSegments ...` silently received a flat
  # array of raw frame numbers instead of [start,end] pairs, corrupting
  # every downstream .Count and index (found 2026-07-22 via a batch run
  # that produced impossible negative segment durations).
  return ,$result
}

# True if $Wav's format is one this library can decode/re-encode.
function Test-SupportedWavFormat {
  param($Wav)
  $bits = $Wav.Format.BitsPerSample
  return ($Wav.Format.AudioFormat -eq 1) -and ($bits -eq 16 -or $bits -eq 24)
}
