param([string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '../../../../..')).Path)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path
$required = @('.quest-instance.json','README.md','app/web/index.html','app/web/vendor/98.css','app/api/Program.cs','app/db/001-schema.sql','app/db/002-seed.sql','docs/images/eagledesk.png','quests/clues.json','quests/flags.sha256','evals/eagledesk-quests/eval.yaml')
foreach ($file in $required) { if (-not (Test-Path -LiteralPath (Join-Path $Root $file) -PathType Leaf)) { throw "Missing $file" } }
$clues = @(Get-Content -Raw (Join-Path $Root 'quests/clues.json') | ConvertFrom-Json)
if ($clues.Count -ne 12 -or (@($clues.quest | Sort-Object -Unique).Count -ne 12)) { throw 'Expected twelve unique quest clues.' }
$hashLines = @(Get-Content (Join-Path $Root 'quests/flags.sha256'))
if ($hashLines.Count -ne 12) { throw 'Expected twelve flag hashes.' }
foreach ($clue in $clues) {
  if ($clue.quest -notin 1..12) { throw 'Invalid quest number.' }
  $questDir = @(Get-ChildItem (Join-Path $Root 'quests') -Directory | Where-Object { $_.Name -like ('{0:D2}-*' -f $clue.quest) })
  if ($questDir.Count -ne 1 -or -not (Test-Path (Join-Path $questDir[0].FullName 'README.md'))) { throw "Missing unique quest $($clue.quest) briefing" }
  $path = Join-Path $Root $clue.file
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing clue file $($clue.file)" }
  $pattern = [regex]::Escape($clue.marker) + ':\s*([a-z0-9-]+)'
  $matchesFound = [regex]::Matches([IO.File]::ReadAllText($path), $pattern)
  if ($matchesFound.Count -ne 1) { throw "Expected one $($clue.marker) marker" }
  $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($matchesFound[0].Groups[1].Value))).ToLowerInvariant()
  $expected = '{0:D2} {1}' -f $clue.quest,$hash
  if ($expected -notin $hashLines) { throw "Flag hash mismatch for quest $($clue.quest)" }
}
$modules = Join-Path $Root 'node_modules'
if (Test-Path -LiteralPath $modules) { $env:NODE_PATH = $modules }
& node (Join-Path $Root 'tests/check-seed.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Seed syntax check failed; install dependencies with npm install.' }
$temp = Join-Path ([IO.Path]::GetTempPath()) ("eagledesk-readiness-" + [guid]::NewGuid().ToString('N'))
try {
  $instance = Get-Content -Raw (Join-Path $Root '.quest-instance.json') | ConvertFrom-Json
  & (Join-Path $PSScriptRoot 'New-QuestInstance.ps1') -SystemName $instance.systemName -AirlineName $instance.airlineName -AirlineCode $instance.airlineCode -OutputPath $temp | Out-Null
  $template = (Resolve-Path (Join-Path $PSScriptRoot '../templates/instance')).Path
  foreach ($file in (Get-ChildItem -LiteralPath $template -File -Recurse -Force)) {
    $relative = [IO.Path]::GetRelativePath($template, $file.FullName)
    $source = Join-Path $Root $relative
    $generated = Join-Path $temp $relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or -not (Test-Path -LiteralPath $generated -PathType Leaf)) { throw "Missing instance file $relative" }
    if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $generated).Hash) { throw "Instance drift: $relative" }
  }
} finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
Write-Output 'Readiness passed: files, twelve clues and hashes, seed syntax, and generation drift. Run npm run test:ui and npm run eval:lint separately.'
