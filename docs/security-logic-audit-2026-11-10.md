# Security and Logic Audit — WT Content Manager

**Date:** 2026-11-10
**Version reviewed:** 0.12.3
**Scope:** Read-only source audit against `docs/manifest.md` and `docs/architecture.md`, covering the React/TypeScript interface, Tauri IPC, Rust backend, persistent local data, HTTP flows, archive installation, installed-skin management, diagnostics, settings, and release configuration.

## Executive summary

The implementation has a good security baseline for a desktop application that consumes community archives: remote requests use HTTPS and host restrictions, responses and downloads have size/time limits, archive extraction rejects unsafe paths and special files, installation uses temporary staging, uninstall validates a single folder name, external links are allowlisted, and diagnostic records are size-bounded and redact Windows profile paths.

Two issues were found in the initial audit and have since been fixed in the working tree:

1. Resetting local app data left the saved image-quality choice behind, despite promising to reset preferences and show setup again.
2. Saving diagnostic settings removed the previous file before renaming the replacement, leaving a crash window in which the next launch could default diagnostics to enabled.

The independent review also identified a P2 data-loss risk during failed skin replacement rollback (SEC-003 below). A versioned transaction journal and conservative recovery flow have since been added.

No critical or high-severity exploitable vulnerability was confirmed by this source review. Runtime behavior against the live WT Live service, Windows filesystem edge cases, and native Tauri UI behavior were not exercised.

## Findings

### SEC-001 — P2 — Diagnostic preference can be lost during an interrupted update (fixed)

**Location:** `src-tauri/src/logging.rs:193-200`
**Impact:** Before the fix, interruption during a preference update after removing `settings.json` but before renaming `settings.tmp` could leave the file missing. Initialization defaults a missing or invalid file to enabled (`logging.rs:66-70`), so an interrupted attempt to opt out could leave diagnostics enabled on the next launch. Ordinary write or rename errors are returned to the caller, and the UI reports a save failure; an already-disabled preference is not rewritten during normal startup or repeated opt-out.

`save_config` now writes a temporary file and renames it over the existing file, preserving the old file until replacement. Rust's `std::fs::rename` documents replacement semantics; actual Windows filesystem fault behavior was not exercised. Existing Rust tests cover normal persistence but not interruption or replacement failure.

### SEC-002 — P3 — Reset local data did not clear the image-quality preference (fixed)

**Location:** `src/lib/localData.ts:1-13`; preference key declared in `src/hooks/useImageQualityPreference.ts:4`
**Impact:** Before the fix, reset removed the library, game path, search, layout, notice, setup, and language keys, then reloaded the app, but left `wt-content-manager-image-quality-v1`. The image-quality selection therefore survived despite the confirmation copy promising to clear preferences and show setup again.

The reset list now includes the image-quality key, so a reload requires setup again.

### SEC-003 — P2 — Failed replacement rollback could delete the previous skin (fixed in working tree)

**Original location:** `src-tauri/src/skins/library.rs:166-175`; cleanup owner at `src-tauri/src/skins/mod.rs:179-186`. **Current implementation:** `src-tauri/src/skins/replacement.rs:81-190`, `src-tauri/src/skins/recovery.rs:33-177`, and `src-tauri/src/skins/mod.rs:220-247`.
**Impact:** Before the fix, replacement moved the existing skin into staging. If moving the new skin into place failed and restoring the previous skin also failed, dropping `InstallStaging` removed the staging directory and could delete the old skin. A process interruption after moving the old skin created the same risk through later orphan cleanup.

Replacement now writes a bounded, versioned journal before moving the old folder and marks it committed after installing the new one. Restart scans and both cleanup paths attempt safe recovery first; incomplete or ambiguous transactions, malformed journals, and legacy backups are excluded from deletion. Preserved recovery folders are surfaced in Settings, and install/uninstall mutations pause while any unresolved recovery folder remains. The journal stores only a validated folder name and fixed internal filenames. Rust recovery and replacement tests were added and passed as part of the final Cargo test run (48 passed).

## Reviewed controls and feature behavior

### Network and external content

- Native WT Live API requests are HTTPS-only, have connection/overall timeouts, restrict redirects to the exact `live.warthunder.com` host, cap response bodies at 8 MiB, and check expected response shapes (`src-tauri/src/providers/wt_live.rs`).
- Skin download URLs and each redirect must use HTTPS on `warthunder.com` or a subdomain; the body is capped at 250 MiB and checked against the declared content length (`src-tauri/src/skins/download.rs`). This is a deliberate trust boundary covering all War Thunder subdomains; keep it under review if WT Live changes its download hosts.
- Frontend image URLs are protocol and host checked before rendering. Description HTML is parsed into text and image data; it is not inserted as HTML. Comment links are constrained to the exact WT Live origin and `/post/` path (`src/lib/wtLiveParser.ts`, `src/lib/wtLive.ts`).
- Tauri external opener permissions are limited to listed WT Live, wiki, and repository URLs (`src-tauri/capabilities/default.json`). The production CSP limits scripts to the app's default source and limits network/image destinations. Inline styles are permitted for the app's styling.
- Browser-development requests do not use the native provider's explicit response-size and timeout controls; this is limited to the documented browser preview/development mode, which cannot install files.

### Archive installation and filesystem operations

- Downloaded files are staged in a randomly named temporary directory and removed by RAII cleanup. Installation validates the game executable marker before writing (`src-tauri/src/skins/mod.rs`).
- ZIP extraction rejects traversal, absolute/drive paths, Windows device names, symlinks and special files; rejects duplicate output paths case-insensitively; limits entry count, depth, per-entry bytes and total extracted bytes; accepts only the declared skin/text file extensions; and opens outputs with `create_new` (`src-tauri/src/skins/paths.rs`, `src-tauri/src/skins/archive/zip.rs`).
- Skin replacement journals its transaction, retains failed/ambiguous backups, and restores interrupted transactions before orphan cleanup. Uninstall rejects path separators, reserved names, symlinks, non-directories, and paths whose canonical parent differs from `UserSkins` (`src-tauri/src/skins/library.rs`, `src-tauri/src/skins/replacement.rs`, `src-tauri/src/skins/recovery.rs`).
- Download pause and cancellation are accepted only during transfer, matching the manifest; extraction is intentionally not interruptible. UI controls are disabled outside the downloading phase.
- Orphan cleanup only considers old directories matching the app's generated staging-name pattern and excludes currently registered staging paths. Manual cleanup requires explicit UI confirmation and reports partial failures. Installation also runs automatic orphan cleanup; that path discards cleanup outcomes.

### Tauri boundary, local data, and diagnostics

- The command registry exposes only the app's declared operations. Commands validate paths/IDs and delegate filesystem scans/uninstall/extraction to blocking workers where appropriate. There is no authentication boundary because commands are local to the app's single trusted WebView; preventing script injection remains important.
- Favorites, installed metadata, preferences, and the selected game path are local WebView storage, not secrets. Stored catalog URLs are validated before use, and the Rust uninstall command independently validates the folder name instead of trusting the stored full path.
- Diagnostics are local, opt-out capable, rotated and bounded; entries are sanitized and Windows profile paths are redacted. No upload or telemetry path was found. SEC-001 identified a preference-persistence issue that has since been fixed in the working tree.

### Manifest and architecture consistency

- The core declared capabilities are implemented in the inspected paths: catalog search/pagination/sort, post details and images, favorites, local installed-skin library, path detection/selection, ZIP install, pause/resume/cancel, uninstall, diagnostics, and image viewing. Sounds remains a placeholder as stated in the manifest.
- `docs/manifest.md` does not list the first-run image-quality choice or temporary-file inspection/cleanup, although both are present in the UI/backend. Update the manifest when convenient so it remains a complete feature inventory.
- `docs/architecture.md` says staging is created under the game's `UserSkins` directory; current code creates staging as a sibling under the game root (`src-tauri/src/skins/mod.rs`, `InstallStaging::new`). The staging and cleanup code agree with each other, so this is documentation drift rather than an observed runtime defect.

## Verification performed

- `node --test scripts/security-regressions.test.mjs`: **passed**, 4 tests.
- `node scripts/check-locales.mjs`: **passed**, English and Spanish keys synchronized with zero errors/warnings.
- `node node_modules/typescript/bin/tsc -b`: **passed**.
- `node node_modules/vite/bin/vite.js build`: **passed**; production bundle generated.
- During the initial audit, Cargo and pnpm checks were blocked by the isolated environment and dependency cache. The final checks were later run outside that sandbox.
- At the initial audit, the report was the only untracked source-tree addition; the generated `dist` output is ignored by Git. The fixes above were applied after that initial audit.

## Post-review remediation verification

- `node --test scripts/security-regressions.test.mjs`: **passed**, 4 tests.
- `node scripts/check-locales.mjs`: **passed**, English and Spanish keys synchronized with zero errors/warnings.
- `node node_modules/typescript/bin/tsc -b` and `node node_modules/vite/bin/vite.js build`: **passed**.
- `rustfmt` on the affected Rust modules and test files: **passed**.
- `cargo test --manifest-path src-tauri/Cargo.toml`: **passed**, 48 tests, 0 failures, when run outside the sandbox.
- `cargo check --manifest-path src-tauri/Cargo.toml --tests` and a clean non-incremental test-target compile: **passed** with no Rust compiler warnings.
- `pnpm tauri dev`: Vite and the Rust backend compiled, and the desktop process launched. Full native UI interaction was not visually reviewed.
- Windows filesystem fault behavior, real-game installation, live WT Live requests, and power-loss durability remain unverified.

## Limits

This is a source-level audit against the repository's own manifest, not a formal verification or penetration test. It did not exercise the live WT Live API, install a real archive into a game directory, simulate Windows filesystem faults, inspect a built installer, or visually test every UI interaction. The Rust test suite passed, but those platform-specific scenarios remain unverified.
