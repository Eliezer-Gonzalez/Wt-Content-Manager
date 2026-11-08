# WT Content Manager

An independent Windows desktop tool for finding and managing community-made War Thunder camouflages.

> **Independent project:** WT Content Manager is not affiliated with, endorsed, sponsored, or approved by Gaijin Entertainment or War Thunder. War Thunder and related marks belong to their respective owners.

## Why this project exists

Managing a user camouflage through the usual manual flow can mean finding a post on War Thunder Live, downloading a ZIP or RAR archive, opening the game folder, extracting and moving files into `UserSkins`, and then cleaning up the archive. This project began as a personal tool to make that routine easier. It is public in case it is useful to other players.

## Current scope

- Browse community camouflage posts from War Thunder Live.
- Save favorites and track locally installed skins.
- Download and install supported camouflage archives into the selected game's `UserSkins` folder, and remove managed installations.
- The current release targets Windows. Camouflage management is the active focus. Sound support and other modules, such as sights, are future work; Linux support and an installer are possibilities under consideration, not current commitments.
- The project is in development. Features, compatibility, and availability may change.

## Privacy and network use

The app has no project-operated account service, server, synchronization, or telemetry. It does not require a Gaijin account or ask for Gaijin credentials. App state such as favorites, the selected game path, and Home display preferences is stored locally. Optional diagnostic logs are stored on the computer and can be disabled in Settings. Installed skins are placed in the game's `UserSkins` folder.

Browsing and downloading content requires an internet connection and contacts War Thunder Live and other relevant third-party services. Those services receive ordinary connection information, such as your IP address. If a connection is unavailable, online browsing and downloads may not work; locally stored favorites and installed files remain on the device.

## Third-party content

Camouflages are community-created files hosted by third parties. Check the source and contents before installing; use downloaded files at your discretion. The project does not guarantee that community content is safe, compatible, current, or available. Do not use this tool to bypass game rules or distribute content without the creator's permission.

## Development

This repository is a personal project shared publicly. Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). The project uses React, TypeScript, Tailwind CSS, Tauri, and Rust. The frontend package manager is pnpm.

### Development setup

Install Node.js, pnpm, and the Rust toolchain required by Tauri on Windows, then run:

```powershell
pnpm install
pnpm tauri:dev
```

To check the frontend build and translations:

```powershell
pnpm build
pnpm check:locales
```

The current Tauri configuration has bundling disabled, so this repository does not currently produce a distributable installer through `tauri build`.

## License

The project is distributed under [GNU GPL v3 or later](LICENSE). Third-party components and their notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
