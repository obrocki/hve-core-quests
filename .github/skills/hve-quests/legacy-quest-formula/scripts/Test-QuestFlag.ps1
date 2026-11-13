param(
  [Parameter(Mandatory)][ValidateRange(1,12)][int]$Quest,
  [Parameter(Mandatory)][string]$Flag,
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '../../../../..')).Path
)
$ErrorActionPreference = 'Stop'
$expected = (Get-Content (Join-Path $Root 'quests/flags.sha256') | Where-Object { $_ -match ('^{0:D2} ' -f $Quest) }) -split ' '
if ($expected.Count -ne 2) { throw "Missing or duplicate hash for quest $Quest" }
$actual = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Flag))).ToLowerInvariant()
if ($actual -ne $expected[1]) { Write-Error 'Flag does not match.'; exit 1 }
Write-Output "Quest $Quest clue verified. Review the quest deliverable separately."
