param(
  [Parameter(Mandatory)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
if ($OutputPath -match '^(?:[\\/]{2}|[a-z][a-z0-9+.-]*://)' -or $OutputPath.Contains('::')) {
  throw 'OutputPath must be a local directory.'
}
$root = Get-Item -LiteralPath $OutputPath -Force
if ($root -isnot [IO.DirectoryInfo] -or -not $root.Parent) { throw 'Expected a local output directory, not a volume root.' }
for ($parent = $root; $null -ne $parent; $parent = $parent.Parent) {
  if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'OutputPath must not pass through a link or junction.' }
}
$rootFull = [IO.Path]::TrimEndingDirectorySeparator($root.FullName)
$comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
$homeDir = Split-Path -Parent $PSScriptRoot
if (Test-Path -LiteralPath (Join-Path $homeDir 'SKILL.md') -PathType Leaf) {
  $repository = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
  $sep = [IO.Path]::DirectorySeparatorChar
  if ($rootFull.Equals($repository, $comparison) -or $rootFull.StartsWith($repository + $sep, $comparison) -or $repository.StartsWith($rootFull + $sep, $comparison)) {
    throw 'OutputPath must be separate from the formula repository.'
  }
} elseif (-not $rootFull.Equals($homeDir, $comparison)) {
  throw 'Run the installed checker against its own output directory.'
}

# Resolve components before reading a file: lexical containment alone misses junctions.
function Get-OutputItem([string]$RelativePath, [switch]$Navigation) {
  $item = $root
  foreach ($part in ($RelativePath -split '[/\\]')) {
    if ($item -isnot [IO.DirectoryInfo]) { return $null }
    if ($Navigation) {
      if ($part -in '', '.') { continue }
      if ($part -eq '..') {
        if ($item.FullName.Equals($rootFull, $comparison)) { return $null }
        $item = $item.Parent
        continue
      }
    }
    if (-not $part -or $part -in '.', '..' -or $part -match '[<>:"|?*\x00-\x1f]|[. ]$|^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') { return $null }
    $path = Join-Path $item.FullName $part
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $item = Get-Item -LiteralPath $path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { return $null }
  }
  return $item
}

function Test-Fields($Object, [string[]]$Names) {
  if ($Object.ValueKind -ne 'Object') { return $false }
  $keys = @($Object.EnumerateObject() | ForEach-Object Name)
  if ($keys.Count -ne $Names.Count) { return $false }
  foreach ($name in $Names) { if ($name -cnotin $keys) { return $false } }
  return $true
}

function Test-StringField($Object, [string]$Name, [string[]]$Allowed) {
  $value = $Object.GetProperty($Name)
  return $value.ValueKind -eq 'String' -and $value.GetString() -cin $Allowed
}

$unknown = 'Governance readiness not met: origin unknown.'
$originFile = Get-OutputItem 'docs/workshop-data.json'
if ($originFile -isnot [IO.FileInfo]) { throw "$unknown Missing or unsafe docs/workshop-data.json; do not backfill." }
try {
  $document = [Text.Json.JsonDocument]::Parse([IO.File]::ReadAllText($originFile.FullName))
} catch [Text.Json.JsonException] {
  throw "$unknown Malformed docs/workshop-data.json."
}
try {
  $data = $document.RootElement
  if (-not (Test-Fields $data @('schemaVersion','purpose','inputMode','intendedAudience','distributionStatus','artifacts')) -or
      $data.GetProperty('schemaVersion').GetRawText() -cne '1' -or
      -not (Test-StringField $data 'purpose' 'workshop') -or
      -not (Test-StringField $data 'inputMode' 'unseeded') -or
      -not (Test-StringField $data 'intendedAudience' 'local') -or
      -not (Test-StringField $data 'distributionStatus' 'not-cleared')) {
    throw "$unknown Expected version 1 local, unseeded workshop metadata with distribution not cleared."
  }
  $entries = $data.GetProperty('artifacts')
  if ($entries.ValueKind -ne 'Array' -or $entries.GetArrayLength() -lt 1) { throw "$unknown Expected a nonempty artifacts array." }
  foreach ($entry in $entries.EnumerateArray()) {
    if (-not (Test-Fields $entry @('scope','method','modelChannelCategory')) -or
        -not (Test-StringField $entry 'method' @('model','manual','deterministic')) -or $entry.GetProperty('scope').ValueKind -ne 'String') {
      throw "$unknown Invalid artifact fields or method."
    }
    $scope = $entry.GetProperty('scope').GetString()
    if ($scope -cnotmatch '\A[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*\z' -or $scope -ieq 'docs/workshop-data.json' -or -not (Get-OutputItem $scope)) {
      throw "$unknown Artifact scope must identify an existing, output-relative file or directory without links."
    }
    if ($entry.GetProperty('method').GetString() -ceq 'model') {
      if (-not (Test-StringField $entry 'modelChannelCategory' @('organization-managed','third-party-managed','on-device'))) {
        throw "$unknown Model artifacts require a non-secret channel category."
      }
    } elseif ($entry.GetProperty('modelChannelCategory').ValueKind -ne 'Null') {
      throw "$unknown Non-model artifacts require a null channel category."
    }
  }
} finally {
  $document.Dispose()
}

function Test-ReadmeLinks([IO.FileInfo]$File) {
  $text = [IO.File]::ReadAllText($File.FullName)
  $text = [regex]::Replace($text, '(?ms)^```[^\r\n]*\r?\n.*?^```[ \t]*\r?$', '')
  foreach ($link in [regex]::Matches($text, '\]\((?:<([^>\r\n]+)>|([^\s()]+))(?:[ \t]+"[^"\r\n]*")?\)')) {
    $target = $link.Groups[1].Value + $link.Groups[2].Value
    if ($target -match '^(?:https?://|mailto:)') { continue }
    $path = [Uri]::UnescapeDataString(($target -split '[?#]', 2)[0])
    if (-not $path) { continue }
    if ($path -match '^[\\/]|:') { throw 'Expected an output-relative README link.' }
    $base = [IO.Path]::GetRelativePath($rootFull, $File.DirectoryName)
    if (-not (Get-OutputItem "$base/$path" -Navigation)) { throw "Broken or out-of-output local link in $($File.Name)." }
  }
}

$required = @(
  'README.md',
  'app/web/index.html',
  'docs/images/eagledesk.png',
  'package.json',
  'scripts/Test-QuestReadiness.ps1',
  'scripts/Test-QuestFlag.ps1',
  'scripts/LICENSE',
  'quests/clues.json',
  'quests/flags.sha256',
  'evals/eagledesk-quests/eval.yaml'
)
foreach ($file in $required) {
  if ((Get-OutputItem $file) -isnot [IO.FileInfo]) {
    throw "Missing or unsafe required output file: $file"
  }
}

Test-ReadmeLinks (Get-OutputItem 'README.md')
$questDirectories = @(Get-ChildItem -LiteralPath (Join-Path $rootFull 'quests') -Directory | Where-Object { $_.Name -match '^\d{2}-' })
if ($questDirectories.Count -ne 12) { throw 'Expected twelve generated quest directories.' }
foreach ($number in 1..12) {
  $prefix = '{0:D2}-' -f $number
  $matchingQuestDirectories = @($questDirectories | Where-Object { $_.Name.StartsWith($prefix, [StringComparison]::Ordinal) })
  if ($matchingQuestDirectories.Count -ne 1) { throw "Expected one quest $prefix directory." }
  $brief = Get-OutputItem "quests/$($matchingQuestDirectories[0].Name)/README.md"
  if ($brief -isnot [IO.FileInfo]) {
    throw "Expected one quest $($number.ToString('D2')) directory with a README."
  }
  Test-ReadmeLinks $brief
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
  $source = Get-OutputItem $clue.file
  if ($source -isnot [IO.FileInfo]) { throw 'Expected a safe output-relative clue file.' }
  $path = $source.FullName
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

Write-Output 'Structural readiness passed: local provenance fields, required files and links, twelve briefs, clue markers/hashes and twelve Vally stimuli. Distribution: not-cleared. This does not verify origin, authorize release, test frontend behavior or establish learner competency.'
