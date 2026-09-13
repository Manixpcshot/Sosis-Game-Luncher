@echo off
chcp 65001 >nul
setlocal
title Sosis Launcher - Setup Builder
color 0B

echo.
echo  ============================================================
echo    Sosis Launcher - Windows Setup Builder (v1.2.0)
echo    Output: dist\SosisLauncherSetup.exe
echo  ============================================================
echo.

REM ---- 1) Node.js check
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js is NOT installed.
  echo      Install Node.js 20 LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo  [OK] Node.js %%v

REM ---- 2) Dependencies
echo.
echo  [1/4] Installing dependencies (npm install)...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

REM ---- 3) Validate (syntax + locales + tests)
echo.
echo  [2/4] Validating project...
call npm run validate
if errorlevel 1 goto :fail

REM ---- 4) Build NSIS setup
echo.
echo  [3/4] Building SosisLauncherSetup.exe (this takes a few minutes)...
call npm run dist
if errorlevel 1 goto :fail

REM ---- 5) Manifests
echo.
echo  [4/4] Generating update manifests...
node scripts\make-manifest.js

echo.
echo  ============================================================
echo    BUILD COMPLETE
echo    Installer : dist\SosisLauncherSetup.exe
echo    Manifests : dist\latest.json + dist\datasetup-manifest.json
echo.
echo    Next steps:
echo      1. Upload SosisLauncherSetup.exe to the admin panel (Files tab)
echo         and Publish the new version  -^> apps auto-update.
echo      2. Optional: publish to GitHub Release:
echo         set GITHUB_TOKEN=... ^&^& bash dist\push-and-upload.sh
echo  ============================================================
echo.
start "" "%~dp0dist"
pause
exit /b 0

:fail
echo.
echo  [X] BUILD FAILED - see the error above.
pause
exit /b 1
