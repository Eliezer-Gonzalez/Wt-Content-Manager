# WT Content Manager Manifest

## Project

WT Content Manager is a desktop application for browsing camouflage posts from the War Thunder Live community and installing downloaded skins into a local War Thunder installation. It also keeps a local favorites and installed-skins library. The Sounds section is a placeholder for future work.

| Field | Value |
| --- | --- |
| Application version | 0.12.2 (keep package, Rust crate, and Tauri versions synchronized) |
| License | GNU GPL v3 or later (`GPL-3.0-or-later`) |
| Frontend | React, TypeScript, Vite, Tailwind CSS 4 |
| Desktop runtime | Tauri 2 |
| Native backend | Rust 2021 |
| Package manager | pnpm |
| Current game integration | War Thunder installation detection and camouflage skin installation |
| Supported language files | English (`en`) and Spanish (`es`) |

## Current capabilities

- Browse and search WT Live camouflage posts, with period and sort controls and paginated loading.
- View post descriptions, images, hashtags, and the original post/comments link.
- Switch between Masonry and Justified catalog layouts.
- Save favorites, record installed skins, and remember the selected game path and UI preferences locally.
- Detect/select a War Thunder installation and install supported ZIP skin archives into its `UserSkins` directory.
- Show download progress and allow pause, resume, or cancellation while bytes are downloading. Archive extraction/installation follows after transfer and is not pausable.
- Configure the War Thunder path and local diagnostic logging in Settings.
- Store bounded diagnostic logs locally by default, with an opt-out; provide controls to copy recent logs or open their folder. No telemetry or automatic upload is used.
- Open WT Live images in an image viewer and zoom/pan within the image.

## Scope and limitations

- The catalog integration targets WT Live's camouflage feed and post-detail endpoints. It is an integration with a third-party service, so response shape, availability, and access rules can change independently.
- The native game-path detection currently uses Windows registry and Steam locations; manually choosing and validating a game directory is also supported.
- The app does not provide WT Live account login, comments, or a sound-mod manager.
- Hard system freezes or forced process termination may prevent the last event from being recorded; logs capture handled frontend/backend errors and Rust panics.
- Browser development mode can render the frontend and call WT Live directly; filesystem installation and native dialogs require the Tauri runtime.
- A Windows NSIS installer target is configured in `src-tauri/tauri.conf.json`. Pushing a version tag that matches the package, Rust crate, and Tauri configuration versions runs `.github/workflows/release.yml` to build and publish the installer.

## Planned distribution work

- Later, add an in-app update flow with Tauri's updater plugin, using signed update artifacts published with each release. This requires a private signing key stored as a GitHub Actions secret and a public key embedded in the app configuration.

## Development commands

Run from the repository root with pnpm:

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm tauri:dev
pnpm tauri:build
```

`pnpm build` runs the TypeScript project build and Vite production build. Rust checks/tests can be run with:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

