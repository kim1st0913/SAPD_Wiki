@echo off
setlocal
cd /d "%~dp0"
set "BUNDLE_ROOT=%CD%"
if not exist "logs" mkdir "logs"
echo [%DATE% %TIME%] start-windows.bat launched> "logs\launcher.log"
echo Bundle root: %BUNDLE_ROOT%>> "logs\launcher.log"
if not exist "SAPD-Wiki-Backend.exe" (
  echo SAPD-Wiki-Backend.exe is missing.
  echo SAPD-Wiki-Backend.exe is missing.>> "logs\launcher.log"
  echo Please check logs\runtime.log or run diagnostics\export-diagnostics.bat.
  pause
  exit /b 1
)
echo Running SAPD-Wiki-Backend...
echo Command: "%BUNDLE_ROOT%\SAPD-Wiki-Backend.exe" --bundle-root "%BUNDLE_ROOT%" %*>> "logs\launcher.log"
"%BUNDLE_ROOT%\SAPD-Wiki-Backend.exe" --bundle-root "%BUNDLE_ROOT%" %* 1>>"logs\backend-console.log" 2>&1
set "SAPD_EXIT=%ERRORLEVEL%"
echo Backend exit code: %SAPD_EXIT%>> "logs\launcher.log"
if not "%SAPD_EXIT%"=="0" (
  echo SAPD Wiki failed to start. Please check logs\runtime.log.
  if exist "logs\backend-console.log" (
    echo.
    echo Last backend console lines:
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\backend-console.log' -Tail 30" 2>nul
  )
  if exist "logs\runtime.log" (
    echo.
    echo Last runtime log lines:
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\runtime.log' -Tail 30" 2>nul
  )
  pause
  exit /b %SAPD_EXIT%
)
echo SAPD Wiki backend exited.
if exist "logs\backend-console.log" (
  echo.
  echo Last backend console lines:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\backend-console.log' -Tail 30" 2>nul
)
if exist "logs\runtime.log" (
  echo.
  echo Last runtime log lines:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\runtime.log' -Tail 30" 2>nul
)
pause
exit /b %SAPD_EXIT%
