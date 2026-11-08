# Architecture

## Overview

The application is a React/Vite frontend hosted by Tauri 2. React owns presentation, view state, localization, and the small local catalog library. Rust owns native filesystem work, game installation discovery/validation, and the desktop-side WT Live requests. The browser development path calls WT Live from the frontend and intentionally cannot install files into the game directory.

```text
React UI (src/)
  ├─ WT Live catalog/detail ── Tauri invoke ── Rust provider ── WT Live API
  │                          └─ browser fetch ──────────────── WT Live API
  └─ skin install ─────────── Tauri command ── download → staging → safe extraction → UserSkins
```

## Frontend structure

- `src/App.tsx` composes the app shell, navigation, catalog and local-library views, and detail/setup dialogs. Feature state is delegated to hooks and components.
- `src/components/` contains focused UI units: post cards and grids, filters, detail and image viewers, the game setup modal, navigation, and download progress.
- `src/hooks/` owns reusable stateful behavior, including game setup, local library persistence, per-section searches, and skin installation UI state.
- `src/hooks/useDiagnosticsSettings.ts` owns Settings diagnostics state, while `src/lib/diagnostics.ts` provides the Tauri IPC calls and uncaught frontend error capture.
- `src/components/SettingsPage.tsx` presents game path and local diagnostics controls in the application's olive, bordered panel style.
- `src/lib/wtLive.ts` defines frontend WT Live types, maps feed data, parses post descriptions into text/image blocks, validates image URLs, and selects the browser or Tauri request path.
- `src/i18n/` loads locale JSON files dynamically. Add a locale by adding a JSON file with the same message keys; `I18nProvider` discovers locale files at build time.
- `src/lib/` contains non-UI helpers for local-library persistence, image URL handling, dates, and app metadata.
- `src/styles.css` and Tailwind utility classes provide the visual system; `src-tauri/tauri.conf.json` configures the frameless desktop window and its content security policy.

## Rust/Tauri structure

- `src-tauri/src/lib.rs` initializes Tauri plugins, shared download-task state, and the IPC command registry.
- `src-tauri/src/commands.rs` is the IPC boundary. It validates/coordinates command inputs and delegates domain work to modules.
- `src-tauri/src/logging.rs` persists bounded local JSONL diagnostics and the opt-out setting; command failures are logged by stable error code.
- `src-tauri/src/http.rs` defines the shared HTTP User-Agent identifier used by outbound requests.
- `src-tauri/src/providers/wt_live.rs` sends form requests to WT Live and validates feed/detail/download-source responses.
- `src-tauri/src/game_install.rs` detects known Windows Steam/Gaijin installations and validates a manually selected path.
- `src-tauri/src/skins/` owns download orchestration, staging lifecycle (`staging.rs`), installed skin scanning/uninstallation (`library.rs`), task controls, archive validation/extraction, safe target paths, and installation results.
- `src-tauri/capabilities/default.json` declares the Tauri permissions available to the main window.

## Main data flows

### Catalog and post details

1. `useCamouflageFeed` and `usePostDetail` coordinate feed pagination, search debouncing, period filtering, and post detail fetching.
2. In Tauri, `src/lib/wtLive.ts` invokes `fetch_recent_camouflages`; the command delegates to the Rust WT Live provider. In browser mode, the frontend sends the corresponding form request.
3. Feed records are mapped to `WtLiveItem` values for cards. Opening a post fetches its details, parsed into ordered text/image blocks and hashtags.
4. Comments are opened through the original WT Live post URL; comments themselves are not mirrored in the app.

### Skin installation

1. The frontend invokes `install_skin` and listens on a Tauri channel for phase and byte progress.
2. Rust validates the game path, obtains the archive URL from the post detail, creates temporary staging under the game's `UserSkins`, and streams the archive to a temporary file.
3. The download manager accepts pause/cancel controls only during transfer. Cancellation/error cleanup removes temporary download/staging data.
4. Once transfer completes, Rust checks the file signature, accepts ZIP archives only, and extracts them on a blocking worker. It rejects unsafe archive paths and oversized inputs before placing the skin in `UserSkins`. Extraction is not currently interruptible from the UI.
5. The frontend records a successful installation in its local library.

### Local preferences and library

Favorites and installed-skin metadata are serialized in browser `localStorage` (`wt-content-manager-library-v1`). The game path, language, searches, and first-run setup flag use separate local storage keys. The installed files remain in the War Thunder directory; localStorage records metadata and paths, not the skin archive.

### Diagnostics and Settings

Settings centralizes the War Thunder path controls and diagnostics. The Rust logger is initialized under Tauri's app data directory (`logs/`), defaults to enabled, and persists the opt-out in a local settings file. It writes newline-delimited JSON records for failed Tauri commands, uncaught frontend errors/rejections, application startup, and Rust panics. The log is capped at 1 MiB with two rotated backups; the copy action reads at most the latest 96 KiB. User-profile paths are redacted and application errors are recorded by stable error code to avoid storing query strings or detailed file paths.

No telemetry, upload, polling, or background reporting is performed. The frontend sends a local IPC log entry only for uncaught errors; handled backend errors are recorded where Tauri commands return. A forced process termination or hard OS-level hang may prevent the last event from being written.

## Boundaries and extension points

- Keep React components focused on rendering; put reusable state transitions in hooks and service/data transformations in `src/lib/`.
- Keep Tauri command handlers thin. Put game, network, download, and archive logic in their respective Rust modules.
- Keep frontend/Rust IPC parameter and response shapes aligned. Progress is event-channel data; command completion returns the final installation result or an error.
- Keep diagnostic output local and bounded; avoid logging search strings, archive contents, or full error details that may contain private paths.
- Locale files share keys. Update `en.json` and `es.json` together when adding user-facing text.
- Sound support should be a separate feature/module: sound mods have different paths and may require composing selected mods by vehicle class, unlike installing a camouflage archive.

## Security and reliability notes

- WT Live and downloaded media/archive URLs are expected to use HTTPS and trusted War Thunder domains.
- Archive extraction applies path and size/entry limits to reduce path traversal and resource-exhaustion risks.
- Treat WT Live responses as external data: validate shapes and URLs before rendering or using them as filesystem/network inputs.
- Favorites, preferences, and installation history are local to the webview profile and are not synchronized or backed up by the app.

