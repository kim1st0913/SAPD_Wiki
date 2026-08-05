param(
  [string]$OutputDir = "dist\windows-backend",

  [ValidatePattern("^[0-9a-f]{40}$")]
  [string]$SourceRevision = $env:GITHUB_SHA
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

if (-not $SourceRevision) {
  throw "SourceRevision or GITHUB_SHA is required for Windows backend provenance."
}

Write-Host "Packaging SAPD Wiki backend for Windows x64 with PyInstaller..."
python -m PyInstaller --version
python scripts\package_backend_pyinstaller.py `
  --output-dir $OutputDir `
  --platform win-x64 `
  --source-revision $SourceRevision `
  --require-native

Write-Host "Backend binary is under $OutputDir\backend\win-x64\SAPD-Wiki-Backend.exe"
