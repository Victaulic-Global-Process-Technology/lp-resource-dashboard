@echo off
setlocal enabledelayedexpansion
echo ====================================
echo  Packaging Resource Dashboard
echo ====================================
echo.

cd /d "%~dp0\.."

:: Release directories (parent of resource-dashboard)
set "RELEASE_DIR=..\release"
set "LATEST_DIR=%RELEASE_DIR%\latest"
set "HISTORY_DIR=%RELEASE_DIR%\history"

:: Ensure release directories exist
if not exist "%LATEST_DIR%" mkdir "%LATEST_DIR%"
if not exist "%HISTORY_DIR%" mkdir "%HISTORY_DIR%"

:: Read version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" package.json') do set RAW_VER=%%~a
set "VERSION=%RAW_VER:"=%"
set "ZIP_NAME=resource-dashboard-%VERSION%.zip"

:: Check if this version was already built
if exist "%HISTORY_DIR%\%ZIP_NAME%" (
    echo  Current version: %VERSION%
    echo  WARNING: v%VERSION% already exists in release\history.
    echo.
    echo  Enter a new version number, or press Enter to rebuild %VERSION% anyway.
    echo.
    set /p "NEW_VER=  New version (e.g. 1.1.0): "

    if defined NEW_VER (
        set "NEW_VER=!NEW_VER: =!"
        echo.
        echo  Updating package.json: %VERSION% -^> !NEW_VER!
        node -e "var f='package.json',p=JSON.parse(require('fs').readFileSync(f));p.version='!NEW_VER!';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
        set "VERSION=!NEW_VER!"
        set "ZIP_NAME=resource-dashboard-!NEW_VER!.zip"
    ) else (
        echo.
        echo  Rebuilding v%VERSION%...
    )
    echo.
)

echo  Version: %VERSION%
echo.

:: Build the app
echo [1/5] Building app...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

:: Stage the package
echo [2/5] Staging package...
if exist "package" rmdir /s /q package
mkdir package
mkdir package\server
mkdir package\app
mkdir package\docs

:: Copy built app (exclude lp-exports from app folder)
xcopy /s /e /q /i dist\* package\app\ /exclude:scripts\package-exclude.txt

:: Copy server binary
echo [3/5] Copying server binary...
if exist "server\serve.exe" (
    copy server\serve.exe package\server\ >nul
    echo   serve.exe copied
) else (
    echo.
    echo   WARNING: server\serve.exe not found!
    echo   Download miniserve from:
    echo   https://github.com/svenstaro/miniserve/releases
    echo   and place it at server\serve.exe
    echo.
)

:: Copy batch scripts and docs
copy scripts\Start_Dashboard.bat package\ >nul
copy scripts\Stop_Dashboard.bat package\ >nul
copy scripts\README.txt package\ >nul
copy scripts\Quick_Start_Guide.txt package\docs\ >nul

:: Archive to history as zip
echo [4/5] Archiving to release\history\%ZIP_NAME%...
powershell -command "Compress-Archive -Path 'package\*' -DestinationPath '%HISTORY_DIR%\%ZIP_NAME%' -Force"

:: Deploy to latest (replace contents)
echo [5/5] Deploying to release\latest...
if exist "%LATEST_DIR%" rmdir /s /q "%LATEST_DIR%"
mkdir "%LATEST_DIR%"
xcopy /s /e /q /i package\* "%LATEST_DIR%\"

:: Clean up staging
rmdir /s /q package

echo.
echo ====================================
echo  Build complete!  v%VERSION%
echo ====================================
echo.
echo  Ready to run:  release\latest\Start_Dashboard.bat
echo  Archived:      release\history\%ZIP_NAME%
for %%A in ("%HISTORY_DIR%\%ZIP_NAME%") do echo  Archive size:  %%~zA bytes
echo.
pause
