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
- `src/hooks/` owns reusable stateful behavior, including game setup, local library persistence, per-section searches, skin installation UI state, and grid layout preference.
- `src/lib/wtLive.ts` defines frontend WT Live types, maps feed data, parses post descriptions into text/image blocks, validates image URLs, and selects the browser or Tauri request path.
- `src/i18n/` loads locale JSON files dynamically. Add a locale by adding a JSON file with the same message keys; `I18nProvider` discovers locale files at build time.
- `src/lib/` contains non-UI helpers for local-library persistence, image URL handling, dates, and app metadata.
- `src/styles.css` and Tailwind utility classes provide the visual system; `src-tauri/tauri.conf.json` configures the frameless desktop window and its content security policy.

## Rust/Tauri structure

- `src-tauri/src/lib.rs` initializes Tauri plugins, shared download-task state, and the IPC command registry.
- `src-tauri/src/commands.rs` is the IPC boundary. It validates/coordinates command inputs and delegates domain work to modules.
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
4. Once transfer completes, Rust validates and extracts ZIP/RAR content on a blocking worker, rejects unsafe archive paths/oversized inputs, and places the skin in `UserSkins`. Extraction is not currently interruptible from the UI.
5. The frontend records a successful installation in its local library.

### Local preferences and library

Favorites and installed-skin metadata are serialized in browser `localStorage` (`wt-content-manager-library-v1`). The game path, language, layout, searches, and first-run setup flag use separate local storage keys. The installed files remain in the War Thunder directory; localStorage records metadata and paths, not the skin archive.

## Boundaries and extension points

- Keep React components focused on rendering; put reusable state transitions in hooks and service/data transformations in `src/lib/`.
- Keep Tauri command handlers thin. Put game, network, download, and archive logic in their respective Rust modules.
- Keep frontend/Rust IPC parameter and response shapes aligned. Progress is event-channel data; command completion returns the final installation result or an error.
- Locale files share keys. Update `en.json` and `es.json` together when adding user-facing text.
- Sound support should be a separate feature/module: sound mods have different paths and may require composing selected mods by vehicle class, unlike installing a camouflage archive.

## Security and reliability notes

- WT Live and downloaded media/archive URLs are expected to use HTTPS and trusted War Thunder domains.
- Archive extraction applies path and size/entry limits to reduce path traversal and resource-exhaustion risks.
- Treat WT Live responses as external data: validate shapes and URLs before rendering or using them as filesystem/network inputs.
- Favorites, preferences, and installation history are local to the webview profile and are not synchronized or backed up by the app.

