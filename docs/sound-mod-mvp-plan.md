# Sound Mod MVP Plan

## Goal

Add a first sound-mod management flow to WT Content Manager, following the camouflage catalog's WT Live browsing pattern and the app's existing military visual identity.

## MVP scope

- Browse and search the WT Live Sounds feed, open post details, and download sound packages to the app's local library.
- Keep downloaded source archives unchanged. Inspect ZIP archives in staging and deploy only validated `.bank` files into the game's flat `sound/mod` directory.
- Support one complete package as the active setup. Do not merge banks or claim package compatibility in this first version.
- Back up the pre-existing `sound/mod` contents before the first install and provide a restore action.
- Block install and restore while the selected War Thunder executable is running or its status cannot be determined. Recheck just before changing game files and handle Windows sharing errors without discarding recovery data.
- Keep sound activation manual; do not edit `config.blk`.
- Preserve the hammer/anvil illustration as a standalone reusable component and keep reduced-motion support.

## Implementation boundaries

- Keep sound feed parsing, package library, archive inspection, deployment, and process detection in separate modules.
- Reuse the existing WT Live post mapping and download progress controls where their contracts fit.
- Do not reuse camouflage-specific `.blk`, `UserSkins`, or archive filtering rules for sounds.
- Keep sound package and recovery state in Tauri app data, separate from browser local storage.
- Keep the Sounds page in focused components and reuse the camouflage post-card/detail patterns and shared military UI components.

## Verification gates

- Confirm the WT Live Sounds API discriminator and supported archive layout against real sound posts before relying on them.
- Use temporary fake game installations for package validation, deploy, restore, and interrupted-recovery scenarios.
- Verify the game process check against the selected install path and sharing-error handling on Windows.
- Run the repository's frontend and Rust checks for the changed logic; visually inspect the Sounds page in the Tauri app.

## Deferred

- Composed profiles that select banks from multiple source packages.
- Automatic compatibility or dependency guarantees.
- Editing `config.blk` or launching/closing War Thunder.
