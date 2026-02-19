@echo off
setlocal enabledelayedexpansion
echo ====================================
echo  Packaging Resource Dashboard
echo ====================================
echo.

cd /d "%~dp0\.."

:: Read version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" package.json') do set RAW_VER=%%~a
set "VERSION=%RAW_VER:"=%"
echo  Version: %VERSION%
echo.

:: Release directories (parent of resource-dashboard)
set "RELEASE_DIR=..\release"
set "LATEST_DIR=%RELEASE_DIR%\latest"
set "HISTORY_DIR=%RELEASE_DIR%\history"
set "ZIP_NAME=resource-dashboard-%VERSION%.zip"

:: Ensure release directories exist
if not exist "%LATEST_DIR%" mkdir "%LATEST_DIR%"
if not exist "%HISTORY_DIR%" mkdir "%HISTORY_DIR%"

:: Rotate: move existing build from latest to history
if exist "%LATEST_DIR%\*.zip" (
    echo  Archiving previous build to release\history...
    for %%F in ("%LATEST_DIR%\*.zip") do (
        move "%%F" "%HISTORY_DIR%\" >nul
        echo    Moved %%~nxF
    )
    echo.
)

:: Clean previous package staging area
if exist "package" rmdir /s /q package
mkdir package
mkdir package\server
mkdir package\app
mkdir package\docs

:: Build the app
echo [1/5] Building app...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

:: Copy built app (exclude lp-exports from app folder)
echo [2/5] Copying build output...
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
echo [4/5] Copying scripts and docs...
copy scripts\Start_Dashboard.bat package\ >nul
copy scripts\Stop_Dashboard.bat package\ >nul
copy scripts\README.txt package\ >nul
copy scripts\Quick_Start_Guide.txt package\docs\ >nul

:: Create zip in release/latest
echo [5/5] Creating release zip...
powershell -command "Compress-Archive -Path 'package\*' -DestinationPath '%LATEST_DIR%\%ZIP_NAME%' -Force"

:: Clean up staging
rmdir /s /q package

echo.
echo ====================================
echo  Build complete!
echo ====================================
echo.
echo  release\latest\%ZIP_NAME%
for %%A in ("%LATEST_DIR%\%ZIP_NAME%") do echo  Size: %%~zA bytes
echo.
pause
