param(
  [Parameter(Mandatory)][ValidateRange(1, 12)][int]$Quest,
  [Parameter(Mandatory)][string]$Flag,
  [Parameter(Mandatory)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $OutputPath).Path
$hashFile = Join-Path $root 'quests/flags.sha256'
if (-not (Test-Path -LiteralPath $hashFile -PathType Leaf)) { throw 'Missing quests/flags.sha256.' }
$matchingLines = @(Get-Content -LiteralPath $hashFile | Where-Object { $_ -match ('^{0:D2} ' -f $Quest) })
if ($matchingLines.Count -ne 1) { throw "Expected one hash for quest $Quest." }
$expected = ($matchingLines[0] -split '\s+')[1]
$actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Flag))).ToLowerInvariant()
if ($actual -ne $expected) { throw 'Flag does not match.' }
Write-Output "Quest $Quest clue verified. Review the quest deliverable separately; this does not establish competency."
