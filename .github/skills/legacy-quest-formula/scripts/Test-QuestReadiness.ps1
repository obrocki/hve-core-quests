param(
  [Parameter(Mandatory)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $OutputPath).Path
$repository = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path.TrimEnd([IO.Path]::DirectorySeparatorChar)
$rootFull = [IO.Path]::GetFullPath($root).TrimEnd([IO.Path]::DirectorySeparatorChar)
$rootPrefix = $rootFull + [IO.Path]::DirectorySeparatorChar
if ($rootFull.Equals($repository, [StringComparison]::OrdinalIgnoreCase) -or $rootFull.StartsWith($repository + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'OutputPath must be outside the formula repository.'
}

$required = @(
  'README.md',
  'app/web/index.html',
  'docs/images/eagledesk.png',
  'quests/clues.json',
  'quests/flags.sha256',
  'evals/eagledesk-quests/eval.yaml'
)
foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $rootFull $file) -PathType Leaf)) {
    throw "Missing required output file: $file"
  }
}

$questDirectories = @(Get-ChildItem -LiteralPath (Join-Path $rootFull 'quests') -Directory | Where-Object { $_.Name -match '^\d{2}-' })
if ($questDirectories.Count -ne 12) { throw 'Expected twelve generated quest directories.' }
foreach ($number in 1..12) {
  $prefix = '{0:D2}-' -f $number
  $matchingQuestDirectories = @($questDirectories | Where-Object { $_.Name.StartsWith($prefix, [StringComparison]::Ordinal) })
  if ($matchingQuestDirectories.Count -ne 1 -or -not (Test-Path -LiteralPath (Join-Path $matchingQuestDirectories[0].FullName 'README.md') -PathType Leaf)) {
    throw "Expected one quest $($number.ToString('D2')) directory with a README."
  }
}

$clues = @(Get-Content -Raw -LiteralPath (Join-Path $rootFull 'quests/clues.json') | ConvertFrom-Json)
if ($clues.Count -ne 12 -or @($clues.quest | Sort-Object -Unique).Count -ne 12) {
  throw 'Expected twelve unique quest clues.'
}
$hashLines = @(Get-Content -LiteralPath (Join-Path $rootFull 'quests/flags.sha256'))
if ($hashLines.Count -ne 12 -or @($hashLines | ForEach-Object { ($_ -split ' ')[0] } | Sort-Object -Unique).Count -ne 12) {
  throw 'Expected twelve unique flag hashes.'
}
foreach ($clue in $clues) {
  $quest = [int]$clue.quest
  if ($quest -notin 1..12) { throw "Invalid quest number: $($clue.quest)" }
  $path = [IO.Path]::GetFullPath([IO.Path]::Combine($rootFull, [string]$clue.file))
  if (-not $path.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Clue path escapes OutputPath: $($clue.file)" }
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing clue file: $($clue.file)" }
  $pattern = [regex]::Escape([string]$clue.marker) + ':\s*([a-z0-9-]+)'
  $markerMatches = [regex]::Matches([IO.File]::ReadAllText($path), $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($markerMatches.Count -ne 1) { throw "Expected one $($clue.marker) marker." }
  $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($markerMatches[0].Groups[1].Value))).ToLowerInvariant()
  $expected = '{0:D2} {1}' -f $quest, $hash
  if ($expected -notin $hashLines) { throw "Flag hash mismatch for quest $quest." }
}

$evalText = [IO.File]::ReadAllText((Join-Path $rootFull 'evals/eagledesk-quests/eval.yaml'))
$stimulusMatches = [regex]::Matches($evalText, '(?m)^\s*-\s+name:\s+quest-(\d{2})[^\r\n]*')
$stimulusNumbers = @($stimulusMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
if ($stimulusMatches.Count -ne 12 -or $stimulusNumbers.Count -ne 12 -or ($stimulusNumbers -join ',') -ne '01,02,03,04,05,06,07,08,09,10,11,12') {
  throw 'Expected one Vally stimulus for each of the twelve quests.'
}

Write-Output 'Readiness passed: required files, twelve quest briefs, clue markers/hashes, and twelve Vally stimuli. This does not test frontend behavior or learner competency.'
