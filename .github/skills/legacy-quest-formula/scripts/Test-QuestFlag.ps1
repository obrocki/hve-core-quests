param(
  [Parameter(Mandatory)][ValidateRange(1, 12)][int]$Quest,
  [Parameter(Mandatory)][string]$Flag,
  [Parameter(Mandatory)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
if ($Flag -cnotmatch '\A[a-z0-9]+(?:-[a-z0-9]+)*\z') { throw 'Expected a lowercase kebab-case clue value.' }
if ($OutputPath -match '^(?:[\\/]{2}|[a-z][a-z0-9+.-]*://)' -or $OutputPath.Contains('::') -or
    $OutputPath -match '(?:^|[\\/])\.\.(?:[\\/]|$)' -or ($IsWindows -and $OutputPath -match '^[a-z]:(?![\\/])')) {
  throw 'OutputPath must be a local directory.'
}
$root = Get-Item -LiteralPath $OutputPath -Force
if ($root -isnot [IO.DirectoryInfo] -or -not $root.Parent) { throw 'Expected a local output directory, not a volume root.' }
for ($parent = $root; $null -ne $parent; $parent = $parent.Parent) {
  if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'OutputPath must not pass through a link or junction.' }
}
$quests = Get-Item -LiteralPath (Join-Path $root.FullName 'quests') -Force -ErrorAction SilentlyContinue
if ($quests -isnot [IO.DirectoryInfo] -or ($quests.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'Expected a local quests directory without links or junctions.'
}
$hashFile = Get-Item -LiteralPath (Join-Path $quests.FullName 'flags.sha256') -Force -ErrorAction SilentlyContinue
if ($hashFile -isnot [IO.FileInfo] -or ($hashFile.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'Missing or unsafe quests/flags.sha256.'
}
$hashLines = [IO.File]::ReadAllLines($hashFile.FullName)
$hashes = @{}
$flagFormat = 'Expected twelve unique flag hashes in the required format.'
if ($hashLines.Length -ne 12) { throw $flagFormat }
foreach ($line in $hashLines) {
  $row = [regex]::Match($line, '\A(0[1-9]|1[0-2]) ([a-f0-9]{64})\z')
  if (-not $row.Success -or $hashes.ContainsKey($row.Groups[1].Value)) { throw $flagFormat }
  $hashes.Add($row.Groups[1].Value, $row.Groups[2].Value)
}
$expected = $hashes[('{0:D2}' -f $Quest)]
$actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Flag))).ToLowerInvariant()
if ($actual -cne $expected) { throw 'Flag does not match.' }
Write-Output "Quest $Quest clue verified. Review the quest deliverable separately; this does not establish competency."
