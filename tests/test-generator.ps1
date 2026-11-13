$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$generator = Join-Path $root '.github/skills/hve-quests/legacy-quest-formula/scripts/New-QuestInstance.ps1'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('quest-generator-test-' + [guid]::NewGuid().ToString('N'))
$env:NODE_PATH = Join-Path $root 'node_modules'
try {
  New-Item -ItemType Directory -Path $temp | Out-Null
  $custom = Join-Path $temp 'custom'
  & $generator -SystemName 'Sky Desk 95' -AirlineName 'Example Airlines' -AirlineCode 'XYZ' -OutputPath $custom
  $html = Get-Content -Raw (Join-Path $custom 'app/web/index.html')
  $readme = Get-Content -Raw (Join-Path $custom 'README.md')
  $mock = Get-Content -Raw (Join-Path $custom 'app/web/mock-data.js')
  if (-not $html.Contains('Sky Desk 95') -or -not $html.Contains('Example Airlines') -or -not $readme.Contains('Sky Desk 95') -or -not $mock.Contains('XYZ101')) { throw 'Custom branding missing.' }
  if ((Get-FileHash (Join-Path $root 'docs/images/eagledesk.png')).Hash -eq (Get-FileHash (Join-Path $custom 'docs/images/eagledesk.png')).Hash) { throw 'Custom screenshot was not regenerated.' }
  & (Join-Path $custom '.github/skills/hve-quests/legacy-quest-formula/scripts/Test-QuestReadiness.ps1')
  $occupied = Join-Path $temp 'occupied'
  New-Item -ItemType Directory -Path $occupied | Out-Null
  [IO.File]::WriteAllText((Join-Path $occupied 'sentinel.txt'), 'unchanged')
  $rejected = $false
  try { & $generator -SystemName 'Sky Desk 95' -OutputPath $occupied } catch { $rejected = $true }
  if (-not $rejected -or [IO.File]::ReadAllText((Join-Path $occupied 'sentinel.txt')) -ne 'unchanged' -or @(Get-ChildItem -Force $occupied).Count -ne 1) { throw 'Nonempty target was not safely rejected.' }
  foreach ($parameter in @('SystemName','AirlineName')) {
    $args = @{ SystemName = 'Sky Desk 95'; AirlineName = 'Example Airlines'; OutputPath = (Join-Path $temp 'whitespace') }
    $args[$parameter] = '   '
    $rejected = $false
    try { & $generator @args } catch { $rejected = $true }
    if (-not $rejected -or (Test-Path $args.OutputPath)) { throw "Whitespace-only $parameter was not rejected." }
  }
  Write-Output 'Custom generation, drift, branding, whitespace and overwrite safeguards passed.'
} finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
