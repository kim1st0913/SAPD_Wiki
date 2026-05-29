@echo off
setlocal
cd /d "%~dp0"
if not exist "SAPD-Wiki-Backend.exe" (
  echo SAPD-Wiki-Backend.exe is missing.
  echo Please check logs\runtime.log or run diagnostics\export-diagnostics.bat.
  pause
  exit /b 1
)
"%~dp0SAPD-Wiki-Backend.exe" --bundle-root "%~dp0" %*
if errorlevel 1 (
  echo SAPD Wiki failed to start. Please check logs\runtime.log.
  pause
  exit /b %errorlevel%
)
