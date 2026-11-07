@echo off
setlocal

rem Run the website from the folder containing this batch file.
cd /d "%~dp0"

set "PORT=8080"
where py >nul 2>&1
if %errorlevel%==0 (
  set "PYTHON=py -3"
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    set "PYTHON=python"
  ) else (
    echo Python was not found. Install Python and try again.
    pause
    exit /b 1
  )
)

start "ClearVoice Server" cmd /k "%PYTHON% -m http.server %PORT% --bind 0.0.0.0"
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/"

echo.
echo ClearVoice is hosted at:
echo   http://localhost:%PORT%
echo.
echo To open it from another device on the same Wi-Fi, use your PC IP address:
echo   http://YOUR-PC-IP:%PORT%
echo Keep the server window open while the website is running.
