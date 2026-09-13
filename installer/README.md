# Installer & Web Bootstrapper

Sosis Launcher ships **two** Windows install artifacts, both produced with
electron-builder (NSIS):

| Artifact | Built by | Purpose |
| --- | --- | --- |
| `dist/SosisLauncherSetup.exe` | `npm run dist` | Full **offline** installer: install directory choice, Desktop + Start Menu shortcuts, uninstaller, launch-after-install. |
| `installer/bootstrapper/dist/SosisLauncherSetup.exe` | `npm run installer:bootstrap` | Small **web** installer (bootstrapper): downloads the payload from the Launcher Download Endpoint, verifies SHA-256, installs, creates shortcuts, launches. |

The web bootstrapper implements the required setup flow exactly:

```
SosisLauncherSetup.exe
   ↓  connect to Launcher Download Endpoint
   ↓  check / download required launcher files
   ↓  show download progress (%, MB done/total, speed, ETA, current file)
   ↓  verify downloaded files (SHA-256)
   ↓  install launcher (silent NSIS run of the verified payload)
   ↓  create shortcuts (NSIS)
   ↓  finish
   ↓  launch Sosis Launcher
```

Failure handling: any download error shows **Retry / Cancel**; a checksum
mismatch shows *"Downloaded file verification failed."* and deletes the partial
file — nothing corrupt is ever installed.

## Launcher Download Endpoint

Configured in `installer/config.json` (not hard-coded in source):

```json
{ "DOWNLOAD_BASE_URL": "https://sosis-shop.top/app/datasetup" }
```

Override at build/run time with `DOWNLOAD_BASE_URL` if needed.

### Server contract

The endpoint must serve a JSON manifest (content-type `application/json`):

```json
{
  "name": "Sosis Launcher",
  "version": "1.0.0",
  "baseUrl": "https://sosis-shop.top/app/datasetup",
  "files": [
    {
      "name": "SosisLauncherSetup.exe",
      "url": "https://sosis-shop.top/app/datasetup/SosisLauncherSetup.exe",
      "sha256": "<hex>",
      "size": 123456789,
      "kind": "installer",
      "run": { "silent": ["/S"], "after": "launch" }
    }
  ]
}
```

Generate it after a release build:

```bash
npm run dist            # builds installer + runs scripts/make-manifest.js
npm run installer:payload   # copies installer + manifest into installer/payload/
```

Upload the contents of `installer/payload/` so that:

- `GET /app/datasetup` returns `index.json` (the manifest above)
- `GET /app/datasetup/SosisLauncherSetup.exe` returns the installer bytes

## Update system manifest

`npm run dist` also writes `dist/latest.json` (spec §45):

```json
{ "version": "1.0.0", "download": "https://sosis-shop.top/app/SosisLauncherSetup.exe", "sha256": "…", "size": 0 }
```

Publish it at `https://sosis-shop.top/app/latest.json` (override with
`SOSIS_UPDATE_URL`). The launcher checks it on start and from Settings → About,
downloads with progress, verifies SHA-256 and hands over to the installer.

## NSIS notes

- `oneClick: false`, user chooses the install directory.
- Desktop + Start Menu shortcuts, uninstaller entry, `runAfterFinish: true`.
- Requested execution level `asInvoker` (no UAC elevation required for per-user installs).
