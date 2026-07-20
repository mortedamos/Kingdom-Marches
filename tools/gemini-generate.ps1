<#
.SYNOPSIS
  Calls the Gemini API to generate (or image-to-image edit) a single game
  art asset per doc/art_style_guide.md.

.PARAMETER Prompt
  Prompt text. Mutually exclusive with -PromptFile.

.PARAMETER PromptFile
  Path to a text file containing the prompt. Mutually exclusive with -Prompt.

.PARAMETER OutputPath
  Where to save the resulting PNG.

.PARAMETER ReferenceImage
  Optional path to an image to feed back in for image-to-image editing —
  used for animation frames 2-4 per style guide §7 (edit frame 1 rather
  than generating each frame independently).

.PARAMETER Model
  Gemini model id. Defaults to gemini-3.1-flash-image (current flash-tier
  image model at time of writing). Swap to gemini-3-pro-image for higher
  quality, or gemini-3.1-flash-lite-image for cheap bulk regeneration.

.PARAMETER ApiKey
  Overrides the key lookup. Normally omitted — falls back to
  $env:GEMINI_API_KEY, then the User-scope environment variable of the
  same name (registry lookup, since $env: doesn't pick up User-scope
  changes made after this shell process started).

.EXAMPLE
  .\tools\gemini-generate.ps1 -PromptFile prompts\orc_raider.txt -OutputPath assets\img\test\orc_raider_api.png
#>

param(
    [string]$Prompt,
    [string]$PromptFile,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$ReferenceImage,
    [string]$Model = "gemini-3.1-flash-image",
    [string]$ApiKey,
    [double]$Temperature = -1
)

# PowerShell's $PWD (what `cd`/Set-Location moves) and .NET's
# Environment.CurrentDirectory (what raw [System.IO.File] calls resolve
# relative paths against) can desync -- confirmed in practice: a relative
# -OutputPath resolved correctly for Test-Path/New-Item but wrote to the
# wrong directory via [System.IO.File]::WriteAllBytes. Resolving to an
# absolute path up front sidesteps the whole class of bug.
if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path (Get-Location).Path $OutputPath
}

if (-not $Prompt -and -not $PromptFile) {
    Write-Error "Provide either -Prompt or -PromptFile."
    exit 1
}
if ($PromptFile) {
    if (-not (Test-Path $PromptFile)) { Write-Error "PromptFile not found: $PromptFile"; exit 1 }
    $Prompt = Get-Content $PromptFile -Raw -Encoding UTF8
}

if (-not $ApiKey) { $ApiKey = $env:GEMINI_API_KEY }
if (-not $ApiKey) { $ApiKey = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User') }
if (-not $ApiKey) {
    Write-Error "No API key found. Set it with: [Environment]::SetEnvironmentVariable('GEMINI_API_KEY', '<key>', 'User')"
    exit 1
}

$parts = @()
if ($ReferenceImage) {
    if (-not (Test-Path $ReferenceImage)) { Write-Error "ReferenceImage not found: $ReferenceImage"; exit 1 }
    $refBytes = [System.IO.File]::ReadAllBytes($ReferenceImage)
    $refB64 = [Convert]::ToBase64String($refBytes)
    $ext = [System.IO.Path]::GetExtension($ReferenceImage).TrimStart('.').ToLower()
    $mime = if ($ext -eq "jpg" -or $ext -eq "jpeg") { "image/jpeg" } else { "image/png" }
    $parts += @{ inlineData = @{ mimeType = $mime; data = $refB64 } }
}
$parts += @{ text = $Prompt }

$requestObj = @{
    contents = @(
        @{ parts = $parts }
    )
}
if ($Temperature -ge 0) {
    $requestObj.generationConfig = @{ temperature = $Temperature }
}

$bodyJson = $requestObj | ConvertTo-Json -Depth 10
# Windows PowerShell 5.1's Invoke-RestMethod mis-encodes non-ASCII characters
# (em-dashes, curly quotes) in a plain string -Body, corrupting the JSON on
# the wire. Encode to UTF-8 bytes explicitly so the payload matches what
# ConvertTo-Json produced.
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)

$uri = "https://generativelanguage.googleapis.com/v1beta/models/${Model}:generateContent?key=$ApiKey"

try {
    $resp = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json; charset=utf-8" -Body $bodyBytes
} catch {
    $ex = $_.Exception
    $bodyText = $null
    if ($ex.Response) {
        $stream = $ex.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $bodyText = $reader.ReadToEnd()
    }
    Write-Error "Request failed: $($ex.Message)"
    if ($bodyText) { Write-Error "Response body: $bodyText" }
    exit 1
}

if (-not $resp.candidates -or $resp.candidates.Count -eq 0) {
    Write-Error "No candidates returned. Full response:"
    $resp | ConvertTo-Json -Depth 10 | Write-Error
    exit 1
}

$imagePart = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1
if (-not $imagePart) {
    $textParts = $resp.candidates[0].content.parts | Where-Object { $_.text } | ForEach-Object { $_.text }
    Write-Error "No image in response. Model returned text instead:"
    Write-Error ($textParts -join "`n")
    $finishReason = $resp.candidates[0].finishReason
    if ($finishReason) { Write-Error "finishReason: $finishReason" }
    exit 1
}

$imgBytes = [Convert]::FromBase64String($imagePart.inlineData.data)
$outDir = Split-Path $OutputPath -Parent
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
try {
    [System.IO.File]::WriteAllBytes($OutputPath, $imgBytes)
} catch {
    Write-Error "Failed to write $OutputPath : $($_.Exception.Message)"
    exit 1
}
if (-not (Test-Path $OutputPath)) {
    Write-Error "WriteAllBytes did not throw but $OutputPath does not exist -- aborting rather than falsely reporting success."
    exit 1
}

"Saved $OutputPath ($([Math]::Round($imgBytes.Length / 1kb, 1)) KB)"
