# Sosis Launcher

> A modern, premium **Windows game launcher** — bilingual (English / Persian with
> true RTL), with library management, safe play-time tracking, an independent
> in-game overlay, an OpenAI-compatible AI assistant, a self-update pipeline and
> a web bootstrapper installer.

```
┌───────────────────────────────────────────────────────────────┐
│  Sosis Launcher                                    —  □  ✕    │
├──────────────┬────────────────────────────────────────────────┤
│  LIBRARY     │   ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  FAVORITES   │   │  COVER   │ │  COVER   │ │  COVER   │       │
│  AI ASSIST   │   ├──────────┤ ├──────────┤ ├──────────┤       │
│  DOWNLOADS   │   │ CoD 3    │ │ Witcher  │ │ Hades    │       │
│              │   │ 12h 42m  │ │ 88h 05m  │ │ 3h 17m   │       │
│  SETTINGS    │   │ ★ [PLAY] │ │ ★ [PLAY] │ │ ★ [PLAY] │       │
│              │   └──────────┘ └──────────┘ └──────────┘       │
└──────────────┴────────────────────────────────────────────────┘
        in-game overlay (separate window):  FPS 144 · PLAY TIME 01:42:18
```

---

## Features

- **Library** — add any `.exe`; name detection, EXE icon extraction (pure-PE
  resource parser, read-only), cover/banner art, favorites, search, six sort
  modes, grid/list views, empty states.
- **Game details** — banner hero, stats (total play time / current session /
  launches), EXE path & folder, *Open Game Folder*, *Locate EXE*, *Edit Game*,
  *Remove Game* (library entry only — game files are never deleted), shortcut
  creation (Desktop + Start Menu).
- **Play tracking** — session starts on launch, process is monitored from the
  outside only (no injection, no patching, no anti-cheat interaction), and on
  exit the session is committed to **Total Play Time**, **Last Played** and
  **Launch Count**, then persisted.
- **In-game overlay** — separate transparent, click-through, always-on-top
  window showing **only FPS and session play time**; configurable position,
  opacity, scale, margin and enable/disable; live preview from settings.
- **AI Assistant** — any OpenAI-compatible endpoint (custom base URL), streaming
  chat, optional library context ("which game should I play?"), artwork
  candidate search (Steam public store / iTunes Search / RAWG / custom URLs)
  with explicit user selection, and a **Test API Connection** button with
  precise success/error messages.
- **Security** — API keys encrypted with Windows `safeStorage` (DPAPI), AES-256-GCM
  fallback elsewhere; `contextIsolation: true`, `nodeIntegration: false`,
  sandboxed overlay, custom privileged protocol instead of `file://`, strict CSP.
- **Bilingual UI** — `locales/en.json` + `locales/fa.json`; Persian is fully
  RTL (sidebar on the right, mirrored layout, RTL animations), English fully LTR.
- **Settings** — General, Appearance (dark/light, accent, UI scale, motion),
  Language, Library, AI Assistant, Downloads, Notifications, Storage, Overlay,
  Advanced, About.
- **Storage** — SQLite (`better-sqlite3`) with automatic atomic-JSON fallback and
  corruption recovery; import/export library.
- **Updates** — manifest-based (`latest.json`), download with progress, SHA-256
  verification, silent hand-off to the installer.
- **Web installer** — `SosisLauncherSetup.exe` bootstrapper that downloads the
  payload from the **Launcher Download Endpoint**
  (`https://sosis-shop.top/app/datasetup`), verifies SHA-256, installs, creates
  shortcuts and launches the app; retry/cancel on failure.

---

## Requirements

- **Windows 10/11 x64** to run the product.
- **Node.js ≥ 20** and npm to develop/build (building the installer works best
  on Windows or in the provided GitHub Actions workflow).

## Quick start (development)

```bash
npm install
npm start          # run the launcher
npm run dev        # same, with dev flag
npm run validate   # syntax + locale parity + unit tests
```

## Build the installer

```bash
npm install
npm run dist       # -> dist/SosisLauncherSetup.exe  (NSIS, offline installer)
```

`predist` automatically fetches the matching **better-sqlite3 prebuild for the
Electron ABI (win32-x64)**, so cross-building from Linux/macOS also produces a
working package. The final NSIS step that stamps the uninstaller needs Windows
(or Wine on Linux); the repository ships a ready-made CI workflow
(`ci/release.yml`, `windows-latest` — copy it to `.github/workflows/release.yml`
to activate) that produces:

- `dist/SosisLauncherSetup.exe` — full offline installer
- `dist/latest.json` + `dist/datasetup-manifest.json` — server manifests
- web bootstrapper artifact (see below)

Web bootstrapper (the downloading setup):

```bash
npm run installer:bootstrap   # -> installer/bootstrapper/dist/SosisLauncherSetup.exe
npm run installer:payload     # stage payload + manifest for upload
```

See [`installer/README.md`](installer/README.md) for the server contract of the
Launcher Download Endpoint.

---

## Project layout

```
SosisLauncher/
├── main.js                  # Electron main entry (boot order, single instance, tray)
├── preload.js               # secure contextBridge API (window.sosis)
├── src/
│   ├── index.html           # renderer shell (CSP, titlebar, splash)
│   ├── app.js               # bootstrap + hash router + event wiring
│   ├── styles.css           # design system (dark premium, glass, RTL)
│   ├── components/          # sidebar, game-card, game-details, search,
│   │                        # settings, overlay-settings, ai-assistant, art-picker…
│   ├── pages/               # library, favorites, game-details, settings, ai, downloads
│   ├── lib/                 # dom, i18n, store, toast, modal, format
│   ├── shared/channels.js   # single IPC channel contract
│   └── main/                # main-process modules
│       ├── ipc.js           # audited IPC router
│       ├── ui/window.js     # window + sosis:// protocol
│       ├── managers/        # Storage, Settings, Secrets, Translation, Game,
│       │                    # Process, Session, Overlay, AI, Update, Downloads,
│       │                    # Notification, Shortcut, IconExtractor
│       └── util/            # log, paths, hash, semver, downloader
├── overlay/                 # independent overlay window (html/css/js/preload)
├── locales/                 # en.json / fa.json (286 keys, parity-checked)
├── database/                # schema.sql + docs (data lives in userData)
├── installer/               # config.json, bootstrapper app, payload tooling
├── scripts/                 # validation, manifests, icons, prebuilds, github
└── ci/                      # release CI workflow (windows-latest), ready to activate
```

## Configuration

| Area | Where | Notes |
| --- | --- | --- |
| App settings | Settings page | persisted per-section in SQLite/JSON |
| AI endpoint | Settings → AI Assistant | provider/base URL/model/key; key encrypted at rest |
| Overlay | Settings → Overlay | position, opacity, scale, margin, FPS toggle, preview |
| Downloads | Settings → Downloads | folder, concurrency, auto-update |
| Installer endpoint | `installer/config.json` | `DOWNLOAD_BASE_URL` (production = `https://sosis-shop.top/app/datasetup`) |
| Update manifest | `SOSIS_UPDATE_URL` env | default `https://sosis-shop.top/app/latest.json` |

### GitHub automation (optional)

```bash
cp .env.example .env     # fill GITHUB_USERNAME / GITHUB_TOKEN / GITHUB_REPOSITORY
npm run github:setup     # create repo if missing, commit, push (token never stored)
```

The token is read **only** from the environment/`.env` (git-ignored). It is never
written to source, README, package.json, logs or git history, and the script
restores a credential-free remote URL after pushing.

---

## Security model

- Renderer is isolated: `contextIsolation: true`, `nodeIntegration: false`;
  a minimal typed API is exposed via `preload.js`; the overlay runs sandboxed.
- App content is served from a privileged `sosis://` scheme with a strict CSP;
  only `art/` and `icons/` subfolders of userData are servable.
- Secrets (AI API key) are encrypted with `safeStorage` (DPAPI on Windows);
  AES-256-GCM with a 0600 master-key file is the documented dev fallback.
- Games are only ever **launched and observed**: `spawn` + read-only process
  listing. No DLL injection, no EXE patching, no memory reading, no anti-cheat
  bypass, no killing of unrelated processes, no registry writes, no telemetry.
- Removing a game deletes only the library record; game files stay untouched.
- Downloads (updates/installer) are SHA-256 verified; mismatches abort install.

## Documented platform limitations & fallbacks (spec §73)

| Feature | Reality on Windows | Safe fallback implemented |
| --- | --- | --- |
| True per-game FPS | Requires injection/ETW — forbidden by design | Overlay measures its own compositor frame rate via `requestAnimationFrame` (equals display/vsync rate for windowed & borderless games); shows `--` when frames stop; toggleable in Settings → Overlay |
| Process tree of a relaunching launcher | Direct child may exit early | "smart" mode polls read-only `tasklist` for the game image until it disappears (configurable interval); "basic" mode uses the child exit event |
| SQLite native module on exotic setups | Prebuild may not match | Automatic atomic-JSON fallback store; backend shown in Settings → Storage |
| Unfinished session at launcher quit | No reliable end signal | Unfinished sessions are discarded (totals count completed sessions only) |
| Windows toasts on other OSes | Unsupported | `Notification.isSupported()` check + in-app toast fallback |

## Testing

```bash
npm run validate     # syntax (all JS), locale parity, i18n usage, unit tests
npm test             # node:test suite (storage fallback, semver, hashing, naming)
```

Manual scenario checklist (spec §69) is covered by the flows above: add game →
play → overlay + session → close → totals persisted → restart → data intact →
language switch RTL/LTR → API key survives restart encrypted → API test
success/failure → overlay disabled stays closed → overlay corner positions →
installer download/retry/verify paths.

## License & notes

MIT — see repository. "Sosis Launcher" branding, icon and artwork generator
outputs are project assets. Game artwork fetched through public metadata APIs
remains property of its owners; the launcher only caches images the user
explicitly selects for their personal library.
