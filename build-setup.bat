@echo off
chcp 65001 >nul
setlocal
title Sosis Launcher - Setup Builder
color 0B

echo.
echo  ============================================================
echo    Sosis Launcher - Windows Setup Builder
echo    Outputs: dist\SosisLauncherSetup.exe  (NSIS, like Steam)
echo             dist\SosisLauncherSetup.msi  (Windows MSI)
echo  ============================================================
echo.

REM ---- 1) Node.js check
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js is NOT installed.
  echo      Install Node.js LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
echo  [OK] Node.js %NODEVER%
echo %NODEVER% | findstr /r "v2[3-9] v3[0-9]" >nul
if not errorlevel 1 (
  echo  [!] Node %NODEVER% is very new. If the build fails, install Node.js 20 LTS
  echo      from https://nodejs.org ^(the script will try automatically anyway^).
)

REM ---- 2) Dependencies (with automatic fallback: the app has a JSON storage
REM         fallback, and the packaged build fetches its own SQLite prebuild,
REM         so a failed native compile must NOT block the installer build)
echo.
echo  [1/4] Installing dependencies (npm install)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo  [!] Native module compile failed ^(node-gyp / better-sqlite3^).
  echo      Retrying with --ignore-scripts ^(SQLite prebuild is fetched later;
  echo      the app automatically falls back to JSON storage if needed^)...
  call npm install --no-audit --no-fund --ignore-scripts
  if errorlevel 1 goto :fail
  if exist node_modules\electron\install.js node node_modules\electron\install.js
)

REM ---- 3) Validate (syntax + locales + tests)
echo.
echo  [2/4] Validating project...
call npm run validate
if errorlevel 1 goto :fail

REM ---- 4) Build NSIS setup + MSI
echo.
echo  [3/4] Building installers ^(NSIS .exe + .msi - takes a few minutes^)...
call npm run dist
if errorlevel 1 goto :fail

REM ---- 5) Manifests
echo.
echo  [4/4] Generating update manifests...
node scripts\make-manifest.js

REM ---- 6) Payload for the tiny web installer (pure Node, always works)
echo.
echo  [extra] Building sosis-payload.zip + staging installer\payload\...
call npm run installer:payload

REM ---- 7) Tiny web installer (needs makensis / NSIS 3.x)
where makensis >nul 2>nul
if errorlevel 1 (
  echo  [extra] makensis not found - skipping SosisLauncherWebSetup.exe.
  echo          Install NSIS 3.x ^(https://nsis.sourceforge.io^) to enable it.
) else (
  echo  [extra] Building tiny web installer...
  call npm run installer:bootstrap
  if errorlevel 1 echo  [extra] web installer build FAILED ^(continuing^)
)

echo.
echo  ============================================================
echo    BUILD COMPLETE
echo    Installer : dist\SosisLauncherSetup.exe
echo    MSI       : dist\SosisLauncherSetup.msi
echo    Web setup : dist\SosisLauncherWebSetup.exe  ^(if makensis found^)
echo    Payload   : dist\sosis-payload.zip  ^(upload to host datasetup folder^)
echo    Manifests : dist\latest.json + dist\datasetup-manifest.json
echo.
echo    Next steps:
echo      1. Upload SosisLauncherSetup.exe to the admin panel (Files tab)
echo         and Publish the new version  -^> apps auto-update.
echo      2. Upload installer\payload\* into the host datasetup folder
echo         ^(Admin panel -^> Files tab^)  -^> the tiny web installer works.
echo      3. Optional: publish everything to the GitHub Release:
echo         in Git-Bash:  GITHUB_TOKEN=... bash scripts/push-and-upload.sh
echo  ============================================================
echo.
start "" "%~dp0dist"
pause
exit /b 0

:fail
echo.
echo  [X] BUILD FAILED - see the error above.
echo      Common fixes:
echo        - Install Node.js 20 LTS ^(https://nodejs.org^) and retry
echo        - Free up disk space, run as Administrator
pause
exit /b 1
