; ============================================================
; Sosis Launcher — standalone NSIS setup (built with makensis
; on any platform; produces the real Windows SosisLauncherSetup.exe)
; Wizard: [Rules] -> [Options: shortcuts/uninstaller] -> [Dir] -> [Install] -> [Finish]
; Silent (/S) support for the auto-update pipeline (all options default ON).
;
; Build (run makensis with an ABSOLUTE script path; the electron-builder NSIS
; build also needs env var "_" set to the makensis path when spawned from Node):
;   makensis -NOCONFIG -INPUTCHARSET UTF8 /path/to/build/standalone-setup.nsi
; ============================================================
Unicode true
SetCompressor /SOLID lzma

Name "Sosis Launcher"
OutFile "${__FILEDIR__}../dist/SosisLauncherSetup.exe"
InstallDir "$LOCALAPPDATA\Programs\Sosis Launcher"
InstallDirRegKey HKCU "Software\SosisLauncher" "InstallLocation"
RequestExecutionLevel user
XPStyle on
ManifestDPIAware true

!define PRODUCT_FILENAME "Sosis Launcher"
!define SHORTCUT_NAME "Sosis Launcher"
!define APP_EXECUTABLE_FILENAME "SosisLauncher.exe"
!define UNINSTALL_FILENAME "Uninstall Sosis Launcher.exe"
!define UNINSTALL_APP_KEY "SosisLauncher"
!define UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\SosisLauncher"
!define INSTALL_REGISTRY_KEY "Software\SosisLauncher"
!define VERSION "1.2.2"
!define SHELL_CONTEXT HKCU
!define SRC_DIR "${__FILEDIR__}../dist/win-unpacked"

VIProductVersion 1.2.2.0
VIAddVersionKey ProductName "Sosis Launcher"
VIAddVersionKey ProductVersion "1.2.2"
VIAddVersionKey FileVersion "1.2.2"
VIAddVersionKey FileDescription "Sosis Launcher Setup"
VIAddVersionKey LegalCopyright "Copyright (c) 2026 Sosis Launcher"
VIAddVersionKey CompanyName "Sosis Launcher"

!include MUI2.nsh
!include x64.nsh
!include FileFunc.nsh

Var newDesktopLink
Var newStartMenuLink

!define MUI_ICON "${__FILEDIR__}icon.ico"
!define MUI_UNICON "${__FILEDIR__}icon.ico"
!define MUI_ABORTWARNING

; rules + options pages (shared with the electron-builder flow, UTF-16)
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

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Sosis Launcher requires 64-bit Windows 10/11."
    Quit
  ${EndIf}
  !insertmacro customInit
FunctionEnd

Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
FunctionEnd

Section "Install"
  SetOutPath $INSTDIR
  File /r "${SRC_DIR}\*.*"

  ; ship the brand icon so shortcuts/ARP show it even when the exe resource
  ; could not be stamped (cross-builds without Wine)
  File /oname=$INSTDIR\SosisLauncher.ico "${__FILEDIR__}icon.ico"
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
