param(
  [Parameter(Mandatory)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
if ($OutputPath -match '^(?:[\\/]{2}|[a-z][a-z0-9+.-]*://)' -or $OutputPath.Contains('::') -or
    $OutputPath -match '(?:^|[\\/])\.\.(?:[\\/]|$)' -or ($IsWindows -and $OutputPath -match '^[a-z]:(?![\\/])')) {
  throw 'OutputPath must be a local directory.'
}
$root = Get-Item -LiteralPath $OutputPath -Force
if ($root -isnot [IO.DirectoryInfo] -or -not $root.Parent) { throw 'Expected a local output directory, not a volume root.' }
for ($parent = $root; $null -ne $parent; $parent = $parent.Parent) {
  if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'OutputPath must not pass through a link or junction.' }
}
$rootFull = [IO.Path]::TrimEndingDirectorySeparator($root.FullName)
$comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
function Test-ContainsPath([string]$Parent, [string]$Child) {
  $prefix = if ([IO.Path]::EndsInDirectorySeparator($Parent)) { $Parent } else { $Parent + [IO.Path]::DirectorySeparatorChar }
  $Child.Equals($Parent, $comparison) -or $Child.StartsWith($prefix, $comparison)
}

$pack = [IO.Directory]::GetParent($PSScriptRoot)
if (Test-Path -LiteralPath (Join-Path $pack.FullName 'SKILL.md') -PathType Leaf) {
  $boundary = $pack
  if ($null -ne $pack.Parent -and $null -ne $pack.Parent.Parent -and $null -ne $pack.Parent.Parent.Parent -and
      $pack.Parent.Name.Equals('skills', $comparison) -and $pack.Parent.Parent.Name.Equals('.github', $comparison)) {
    $boundary = $pack.Parent.Parent.Parent
  }
  # An export inside a Git checkout still has that checkout's boundary; a loose pack has none.
  for ($parent = $boundary; $parent.Parent; $parent = $parent.Parent) {
    if (Test-Path -LiteralPath (Join-Path $parent.FullName '.git')) {
      $boundary = $parent
      break
    }
  }
  if ((Test-ContainsPath $boundary.FullName $rootFull) -or (Test-ContainsPath $rootFull $boundary.FullName)) {
    throw 'OutputPath must be separate from the formula pack or repository.'
  }
} elseif (-not $rootFull.Equals($pack.FullName, $comparison)) {
  throw 'Run the installed checker against its own output directory.'
}
for ($parent = $root; $parent.Parent; $parent = $parent.Parent) {
  if ((Test-Path -LiteralPath (Join-Path $parent.FullName '.github/skills/legacy-quest-formula/SKILL.md') -PathType Leaf) -and
      (Test-Path -LiteralPath (Join-Path $parent.FullName '.github/skills/legacy-quest-formula/scripts/Test-QuestReadiness.ps1') -PathType Leaf)) {
    throw 'OutputPath must be outside the formula repository.'
  }
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

$hashLines = [IO.File]::ReadAllLines((Get-OutputItem 'quests/flags.sha256').FullName)
$hashes = @{}
$flagFormat = 'Expected twelve unique flag hashes in the required format.'
if ($hashLines.Length -ne 12) { throw $flagFormat }
foreach ($line in $hashLines) {
  $row = [regex]::Match($line, '\A(0[1-9]|1[0-2]) ([a-f0-9]{64})\z')
  if (-not $row.Success -or $hashes.ContainsKey($row.Groups[1].Value)) { throw $flagFormat }
  $hashes.Add($row.Groups[1].Value, $row.Groups[2].Value)
}

try {
  $clueDocument = [Text.Json.JsonDocument]::Parse([IO.File]::ReadAllText((Get-OutputItem 'quests/clues.json').FullName))
} catch [Text.Json.JsonException] {
  throw 'Malformed quest clue manifest.'
}
try {
  $clues = $clueDocument.RootElement
  if ($clues.ValueKind -ne 'Array' -or $clues.GetArrayLength() -ne 12) { throw 'Expected twelve unique quest clues.' }
  $questsWithClues = [Collections.Generic.HashSet[int]]::new()
  $markers = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($clue in $clues.EnumerateArray()) {
    $quest = 0
    if (-not (Test-Fields $clue @('quest', 'file', 'marker')) -or $clue.GetProperty('quest').ValueKind -ne 'Number' -or
        -not $clue.GetProperty('quest').TryGetInt32([ref]$quest) -or $quest -notin 1..12 -or -not $questsWithClues.Add($quest) -or
        $clue.GetProperty('file').ValueKind -ne 'String' -or $clue.GetProperty('marker').ValueKind -ne 'String') {
      throw 'Expected a unique integer quest number, source path and marker.'
    }
    $marker = $clue.GetProperty('marker').GetString()
    if (-not $marker.Trim() -or $marker -cne $marker.Trim() -or $marker -match '[:\r\n]' -or -not $markers.Add($marker)) {
      throw 'Expected a unique nonblank clue marker.'
    }
    $source = Get-OutputItem ($clue.GetProperty('file').GetString())
    if ($source -isnot [IO.FileInfo]) { throw 'Expected a safe output-relative clue file.' }
    $prefix = [regex]::new('\A[ \t]*(?:(?<comment><!--|/\*|//|--|#|;|'')[ \t]*)?' + [regex]::Escape($marker) + ':',
      [Text.RegularExpressions.RegexOptions]'IgnoreCase,CultureInvariant')
    $count = 0
    $value = $null
    foreach ($line in [IO.File]::ReadLines($source.FullName)) {
      $start = $prefix.Match($line)
      if (-not $start.Success) { continue }
      $count++
      if (-not $start.Value.EndsWith("${marker}:", [StringComparison]::Ordinal)) { continue }
      $end = switch ($start.Groups['comment'].Value) {
        '<!--' { '-->' }
        '/*' { '\*/' }
        default { '' }
      }
      $flag = [regex]::Match($line.Substring($start.Length), '\A (?<value>[a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*' + $end + '[ \t]*\z')
      if ($flag.Success) { $value = $flag.Groups['value'].Value }
    }
    if ($count -ne 1 -or -not $value) { throw "Expected one correctly formatted clue marker line for quest $quest." }
    $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($value))).ToLowerInvariant()
    if ($hash -cne $hashes[('{0:D2}' -f $quest)]) { throw "Flag hash mismatch for quest $quest." }
  }
} finally {
  $clueDocument.Dispose()
}

function Get-BlockItems([string]$Text, [int]$MinimumIndent) {
  $first = [regex]::Match($Text, '(?m)^(?<indent> *)[^ #\n]')
  if (-not $first.Success -or $first.Groups['indent'].Length -lt $MinimumIndent) { return }
  $indent = $first.Groups['indent'].Value
  [regex]::Matches($Text, "(?ms)^(?<indent>$indent)(?<header>[^ #\n][^\n]*)\n?(?<body>.*?)(?=^$indent[^ #\n]|\z)")
}

function Get-YamlSlug([string]$Text) {
  [regex]::Match($Text, '\A[ \t]*(?<quote>["'']?)(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\k<quote>(?:[ \t]+#[^\n]*)?[ \t]*\z').Groups['slug'].Value
}

# Inspect only the documented block-list form; Vally lint owns full YAML and grader validation.
$evalText = [IO.File]::ReadAllText((Get-OutputItem 'evals/eagledesk-quests/eval.yaml').FullName).Replace("`r`n", "`n")
$stimulusError = 'Expected one Vally stimulus for each of the twelve quests in the stimuli block list.'
$blocks = [regex]::Matches($evalText, '(?ms)^stimuli:[ \t]*(?:#[^\n]*)?\n(?<items>.*?)(?=^[^ #\n-]|\z)')
if ($blocks.Count -ne 1) { throw $stimulusError }
$stimuli = @(Get-BlockItems $blocks[0].Groups['items'].Value 0)
if ($stimuli.Count -ne 12) { throw $stimulusError }
$questNumbers = [Collections.Generic.HashSet[string]]::new()
$graderNames = [Collections.Generic.HashSet[string]]::new()
$graderError = 'Expected at least one typed grader per Vally stimulus, with globally unique grader names.'
foreach ($stimulus in $stimuli) {
  $header = [regex]::Match($stimulus.Groups['header'].Value, '\A- name:[ \t]+(?<value>.*)\z')
  $name = Get-YamlSlug $header.Groups['value'].Value
  if ($name -cnotmatch '\Aquest-(0[1-9]|1[0-2])-' -or -not $questNumbers.Add($name.Substring(6, 2))) { throw $stimulusError }
  $indent = $stimulus.Groups['indent'].Value + '  '
  $graders = [regex]::Matches($stimulus.Groups['body'].Value,
    "(?ms)^${indent}graders:[ \t]*(?:#[^\n]*)?\n(?<items>.*?)(?=^${indent}[^ #\n-]|\z)")
  if ($graders.Count -ne 1) { throw $graderError }
  $items = @(Get-BlockItems $graders[0].Groups['items'].Value $indent.Length)
  if (-not $items.Count) { throw $graderError }
  foreach ($grader in $items) {
    $header = $grader.Groups['header'].Value
    $fieldIndent = $grader.Groups['indent'].Value + '  '
    if ($header -cnotmatch '\A-(?: |\z)') { throw $graderError }
    $fields = "$fieldIndent$($header.Substring([Math]::Min(2, $header.Length)))`n$($grader.Groups['body'].Value)"
    $types = [regex]::Matches($fields, "(?m)^${fieldIndent}type:[ \t]+(?<value>[^\n]*)$")
    $names = [regex]::Matches($fields, "(?m)^${fieldIndent}name:[ \t]+(?<value>[^\n]*)$")
    if ($types.Count -ne 1 -or $names.Count -ne 1 -or -not (Get-YamlSlug $types[0].Groups['value'].Value) -or
        -not ($graderName = Get-YamlSlug $names[0].Groups['value'].Value) -or -not $graderNames.Add($graderName)) {
      throw $graderError
    }
  }
}

Write-Output 'Structural readiness passed: local provenance fields, required files and links, twelve briefs, clue markers/hashes and twelve Vally stimuli with named typed graders. Distribution: not-cleared. This does not verify origin, authorize release, test frontend behavior or establish learner competency.'
