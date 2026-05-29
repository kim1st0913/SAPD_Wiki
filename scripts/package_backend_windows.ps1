param(
  [string]$OutputDir = "dist\zip-alpha"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

Write-Host "Packaging SAPD Wiki backend for Windows x64 with PyInstaller..."
python -m PyInstaller --version
python scripts\package_backend_pyinstaller.py `
  --output-dir $OutputDir `
  --platform win-x64 `
  --require-native

Write-Host "Backend binary is under $OutputDir\backend\win-x64\SAPD-Wiki-Backend.exe"
