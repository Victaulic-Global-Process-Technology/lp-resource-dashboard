@echo off
echo Stopping Dashboard server...
taskkill /f /fi "WINDOWTITLE eq DashboardServer" >nul 2>&1
taskkill /f /im serve.exe >nul 2>&1
echo Dashboard stopped.
timeout /t 2 >nul
