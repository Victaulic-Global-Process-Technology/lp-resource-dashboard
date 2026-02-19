@echo off
title Resource Dashboard - Fire Suppression Technology
echo.
echo  ========================================
echo    Resource Dashboard
echo    Fire Suppression Technology
echo  ========================================
echo.
echo  Starting dashboard server...
echo.

cd /d "%~dp0"

:: Check if port 4173 is already in use
netstat -an | find "4173" | find "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  Dashboard is already running!
    echo  Opening browser...
    start http://localhost:4173
    timeout /t 3 >nul
    exit
)

:: Start server in background
start /min "DashboardServer" server\serve.exe --index index.html -p 4173 app

:: Wait for server to start
timeout /t 2 >nul

:: Open browser
start http://localhost:4173

echo.
echo  Dashboard is running at http://localhost:4173
echo  Leave this window open while using the dashboard.
echo  To stop, close this window or run "Stop Dashboard.bat"
echo.
pause
