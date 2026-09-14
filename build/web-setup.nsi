; ============================================================
; Sosis Launcher — WEB SETUP (tiny bootstrapper, ~315 KB)
; Downloads the compressed app payload (sosis-payload.zip) from
; https://app.sosis-shop.top/datasetup (GitHub release = mirror),
; verifies SHA-256 with certutil, extracts with bsdtar (Win10+)
; and falls back to PowerShell Expand-Archive.
;
; Wizard: [Lang] -> [Rules] -> [Options] -> [Dir] -> [Install] -> [Finish]
; Silent: /S   Optional: /URL=<payload-url> /SHA256=<hex>
; Build (run makensis with an ABSOLUTE script path; from Node also pass
; env var "_" = makensis path):
;   makensis -NOCONFIG -INPUTCHARSET UTF8 /path/to/build/web-setup.nsi
; ============================================================
Unicode true
SetCompressor /SOLID lzma

Name "Sosis Launcher"
OutFile "${__FILEDIR__}../dist/SosisLauncherWebSetup.exe"
InstallDir "$LOCALAPPDATA\Programs\Sosis Launcher"
InstallDirRegKey HKCU "Software\SosisLauncher" "InstallLocation"
RequestExecutionLevel user
XPStyle on
ManifestDPIAware true

!define PRODUCT_FILENAME "Sosis Launcher"
!define SHORTCUT_NAME "Sosis Launcher"
!define APP_EXECUTABLE_FILENAME "SosisLauncher.exe"
!define UNINSTALL_FILENAME "Uninstall Sosis Launcher.exe"
!define UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\SosisLauncher"
!define INSTALL_REGISTRY_KEY "Software\SosisLauncher"
!define VERSION "1.2.2"
!define SHELL_CONTEXT HKCU

!define PAYLOAD_HOST   "https://app.sosis-shop.top/datasetup/sosis-payload.zip"
!define PAYLOAD_MIRROR "https://github.com/Manixpcshot/Sosis-Game-Luncher/releases/latest/download/sosis-payload.zip"
!define SHA_HOST       "https://app.sosis-shop.top/datasetup/sosis-payload.sha256"
!define SHA_MIRROR     "https://github.com/Manixpcshot/Sosis-Game-Luncher/releases/latest/download/sosis-payload.sha256"

VIProductVersion 1.2.2.0
VIAddVersionKey ProductName "Sosis Launcher"
VIAddVersionKey ProductVersion "1.2.2"
VIAddVersionKey FileVersion "1.2.2"
VIAddVersionKey FileDescription "Sosis Launcher Web Setup"
VIAddVersionKey LegalCopyright "Copyright (c) 2026 Sosis Launcher"
VIAddVersionKey CompanyName "Sosis Launcher"

!include MUI2.nsh
!include x64.nsh
!include FileFunc.nsh

Var newDesktopLink
Var newStartMenuLink
Var payloadZip
Var shaFile
Var cliUrl
Var cliSha

!define MUI_ICON "${__FILEDIR__}icon.ico"
!define MUI_UNICON "${__FILEDIR__}icon.ico"
!define MUI_ABORTWARNING

; rules + options pages (shared, UTF-16)
!include "${__FILEDIR__}installer.nsh"
!insertmacro customWelcomePage

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Run Sosis Launcher"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Farsi"

; ------------------------------------------------------------ helpers
Var dlUrl
Var dlDest
Var dlResult
Var dlTries
Var scHay
Var scNeedle
Var scResult

; Case-insensitive substring test (NSIS StrCmp is case-insensitive).
; In: $scHay, $scNeedle -> Out: $scResult = "yes" or ""
Function StrContainsCI
  Push $0
  Push $1
  Push $2
  Push $3
  StrLen $2 $scNeedle
  StrLen $1 $scHay
  IntOp $1 $1 - $2
  StrCpy $scResult ""
  StrCpy $0 0
  IntCmp $1 0 _sci_loop _sci_done _sci_loop
_sci_loop:
  IntCmp $0 $1 _sci_test _sci_test _sci_done
_sci_test:
  StrCpy $3 $scHay $2 $0
  StrCmp $3 $scNeedle _sci_found
  IntOp $0 $0 + 1
  Goto _sci_loop
_sci_found:
  StrCpy $scResult "yes"
_sci_done:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; NSISdl download with 3 attempts.
; In: $dlUrl, $dlDest -> Out: $dlResult = "success"/"error" (cancel aborts)
Function DownloadRetry
  StrCpy $dlTries 0
_dr_try:
  IntOp $dlTries $dlTries + 1
  DetailPrint "Download attempt $dlTries/3: $dlUrl"
  NSISdl::download /TIMEOUT=20000 /RETRIES=1 "$dlUrl" "$dlDest"
  Pop $dlResult
  StrCmp $dlResult "success" _dr_done
  StrCmp $dlResult "cancel" _dr_cancel
  DetailPrint "  failed: $dlResult"
  IntCmp $dlTries 3 _dr_fail
  Sleep 1500
  Goto _dr_try
_dr_cancel:
  DetailPrint "Download cancelled by user."
  Abort
_dr_fail:
  StrCpy $dlResult "error"
_dr_done:
FunctionEnd

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Sosis Launcher requires 64-bit Windows 10/11."
    Quit
  ${EndIf}
  !insertmacro customInit
  StrCpy $payloadZip "$TEMP\sosis-payload.zip"
  StrCpy $shaFile "$TEMP\sosis-payload.sha256"
  StrCpy $cliUrl ""
  StrCpy $cliSha ""
  Push $R0
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/URL=" $0
  IfErrors _oi_nourl
  StrCpy $cliUrl $0
_oi_nourl:
  ClearErrors
  ${GetOptions} $R0 "/SHA256=" $0
  IfErrors _oi_nosha
  StrCpy $cliSha $0
_oi_nosha:
  Pop $R0
  Delete $payloadZip
  Delete $shaFile
FunctionEnd

Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
FunctionEnd

Section "Install"
  SetOutPath $INSTDIR

  ; ---- 1) expected SHA-256 -------------------------------------------------
  StrCpy $9 $cliSha
  StrCmp $9 "" 0 _have_sha
  DetailPrint "Fetching checksum: ${SHA_HOST}"
  StrCpy $dlUrl "${SHA_HOST}"
  StrCpy $dlDest $shaFile
  Call DownloadRetry
  StrCmp $dlResult "success" _read_sha
  DetailPrint "Host checksum unavailable, trying mirror..."
  StrCpy $dlUrl "${SHA_MIRROR}"
  StrCpy $dlDest $shaFile
  Call DownloadRetry
  StrCmp $dlResult "success" _read_sha _sha_missing
_read_sha:
  FileOpen $7 $shaFile r
  FileRead $7 $9
  FileClose $7
  StrCpy $9 $9 64            ; "<64 hex>  sosis-payload.zip"
_have_sha:
  StrLen $8 $9
  IntCmp $8 64 _sha_ok _sha_missing _sha_missing
_sha_ok:
  DetailPrint "Expected SHA-256: $9"
  Goto _sha_done
_sha_missing:
  MessageBox MB_OK|MB_ICONSTOP "Could not retrieve the payload checksum. Installation aborted for your safety.$\r$\nدریافت کد تأیید ممکن نشد؛ نصب متوقف شد."
  Abort
_sha_done:

  ; ---- 2) payload download (host -> mirror; /URL= wins) --------------------
  StrCmp $cliUrl "" 0 _dl_cli
_dl_host:
  DetailPrint "Downloading app payload from host (~118 MB)..."
  StrCpy $dlUrl "${PAYLOAD_HOST}"
  StrCpy $dlDest $payloadZip
  Call DownloadRetry
  StrCmp $dlResult "success" _dl_done
  DetailPrint "Host download failed, trying GitHub mirror..."
  StrCpy $dlUrl "${PAYLOAD_MIRROR}"
  StrCpy $dlDest $payloadZip
  Call DownloadRetry
  StrCmp $dlResult "success" _dl_done _dl_failed
_dl_cli:
  DetailPrint "Downloading app payload from custom URL..."
  StrCpy $dlUrl $cliUrl
  StrCpy $dlDest $payloadZip
  Call DownloadRetry
  StrCmp $dlResult "success" _dl_done _dl_failed
_dl_failed:
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Download failed. Check your connection and retry.$\r$\nدانلود ناموفق بود؛ اتصال را بررسی کرده و دوباره تلاش کنید." IDRETRY _dl_retry
  Abort
_dl_retry:
  Delete $payloadZip
  StrCmp $cliUrl "" _dl_host _dl_cli
_dl_done:

  ; ---- 3) SHA-256 verification via certutil --------------------------------
  DetailPrint "Verifying SHA-256 (certutil)..."
  nsExec::ExecToStack 'certutil -hashfile "$payloadZip" SHA256'
  Pop $8               ; exit code
  Pop $7               ; output
  StrCmp $8 "0" 0 _verify_failed
  StrCpy $scHay $7
  StrCpy $scNeedle $9
  Call StrContainsCI
  StrCmp $scResult "yes" _verify_ok
_verify_failed:
  DetailPrint "Checksum mismatch! Output: $7"
  Delete $payloadZip
  MessageBox MB_RETRYCANCEL|MB_ICONSTOP "SHA-256 verification failed - the download is corrupt or tampered with. The file was deleted.$\r$\nتأیید SHA-256 ناموفق بود؛ فایل حذف شد." IDRETRY _dl_retry
  Abort
_verify_ok:
  DetailPrint "Checksum OK."

  ; ---- 4) extract: bsdtar (Win10+), PowerShell fallback ---------------------
  DetailPrint "Extracting to $INSTDIR ..."
  nsExec::ExecToLog 'tar -xf "$payloadZip" -C "$INSTDIR"'
  Pop $8
  StrCmp $8 "0" _extract_check
  DetailPrint "tar failed ($8), falling back to PowerShell Expand-Archive..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath ''$payloadZip'' -DestinationPath ''$INSTDIR'' -Force"'
  Pop $8
_extract_check:
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" _extract_ok
  DetailPrint "Extraction failed (exit=$8)"
  MessageBox MB_OK|MB_ICONSTOP "Extraction failed. Not enough disk space or blocked by antivirus.$\r$\nاستخراج فایل‌ها ناموفق بود."
  Abort
_extract_ok:
  DetailPrint "Extraction complete."
  Delete $payloadZip
  Delete $shaFile

  ; ---- 5) shortcuts / registry / uninstaller --------------------------------
  ; ship the brand icon so shortcuts/ARP show it even when the exe resource
  ; could not be stamped (cross-builds without Wine)
  File /oname="$INSTDIR\SosisLauncher.ico" "${__FILEDIR__}icon.ico"
  StrCpy $newDesktopLink "$DESKTOP\${SHORTCUT_NAME}.lnk"
  StrCpy $newStartMenuLink "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
  CreateShortcut "$newDesktopLink" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\SosisLauncher.ico" 0
  CreateShortcut "$newStartMenuLink" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\SosisLauncher.ico" 0

  WriteUninstaller "$INSTDIR\${UNINSTALL_FILENAME}"

  WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayName" "Sosis Launcher"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString" '"$INSTDIR\${UNINSTALL_FILENAME}"'
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString" '"$INSTDIR\${UNINSTALL_FILENAME}" /S'
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" "$INSTDIR\SosisLauncher.ico,0"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "Publisher" "Sosis Launcher"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "NoModify" 1
  WriteRegDWORD SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "NoRepair" 1
  Push $0
  Push $1
  Push $2
  ${GetSize} "$INSTDIR" "/S=0K /G=0" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "EstimatedSize" $0
  Pop $2
  Pop $1
  Pop $0

  ; applies the options-page choices (shortcuts / uninstaller opt-out)
  !insertmacro customInstall
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  Delete "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
  Delete "$INSTDIR\SosisLauncher.ico"
  Delete "$INSTDIR\${UNINSTALL_FILENAME}"
  ${If} $INSTDIR != ""
    RMDir /r "$INSTDIR"
  ${EndIf}
  DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
SectionEnd
