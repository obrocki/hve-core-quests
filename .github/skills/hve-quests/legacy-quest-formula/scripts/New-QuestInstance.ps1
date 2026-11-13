param(
  [Parameter(Mandatory)][ValidateScript({ -not [string]::IsNullOrWhiteSpace($_) })][ValidatePattern('^[\p{L}\p{N} ._-]+$')][string]$SystemName,
  [ValidateScript({ -not [string]::IsNullOrWhiteSpace($_) })][ValidatePattern('^[\p{L}\p{N} ._-]+$')][string]$AirlineName = 'High Velocity Eagle Airlines',
  [ValidatePattern('^[A-Z]{3}$')][string]$AirlineCode = 'HVE',
  [Parameter(Mandatory)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$template = Join-Path $PSScriptRoot '../templates/instance'
$skill = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$output = [IO.Path]::GetFullPath($OutputPath)
if ($output.StartsWith($skill + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or $output -eq $skill) { throw 'Output cannot be inside the skill directory.' }
if (Test-Path $output) {
  if ((Get-ChildItem -Force $output | Measure-Object).Count -ne 0) { throw "Output directory must be empty: $output" }
} else { New-Item -ItemType Directory -Path $output | Out-Null }
Get-ChildItem -LiteralPath $template -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $output -Recurse -Force
}
$textExtensions = @('.md','.html','.js','.css','.cs','.csproj','.sql','.json','.yml','.yaml','.conf','.ps1','.asp','.asa','.cls','.bas','.vbp','.aspx','.config','.cjs','.sha256','')
Get-ChildItem -LiteralPath $output -File -Recurse -Force | Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() -and $_.FullName -notmatch '[\\/]vendor[\\/]' } | ForEach-Object {
  $text = [IO.File]::ReadAllText($_.FullName)
  $text = $text.Replace('{{SYSTEM_NAME}}', $SystemName).Replace('{{AIRLINE_NAME}}', $AirlineName).Replace('{{AIRLINE_CODE}}', $AirlineCode)
  [IO.File]::WriteAllText($_.FullName, $text, [Text.UTF8Encoding]::new($false))
}
$skillParent = Join-Path $output '.github/skills/hve-quests'
New-Item -ItemType Directory -Force -Path $skillParent | Out-Null
Copy-Item -LiteralPath $skill -Destination $skillParent -Recurse -Force
if ($SystemName -ne 'EagleDesk 95' -or $AirlineName -ne 'High Velocity Eagle Airlines' -or $AirlineCode -ne 'HVE') {
  $test = Join-Path $output 'tests/ui.cjs'
  $modules = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '../../../../..')).Path 'node_modules'
  if (Test-Path -LiteralPath $modules) { $env:NODE_PATH = $modules }
  & node $test --screenshot-only
  if ($LASTEXITCODE -ne 0) { throw 'Screenshot capture failed. Install Playwright and its browser, then generate into a new empty directory.' }
}
Write-Output "Generated $SystemName at $output"
