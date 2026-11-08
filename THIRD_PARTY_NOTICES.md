# Third-party notices

## ZIP support

ZIP extraction uses the Rust `zip` crate, licensed under MIT. See the crate's
license at <https://github.com/zip-rs/zip2/blob/master/LICENSE>.

## RAR support

RAR extraction uses `unrar-rs` under Apache-2.0 with an additional restriction
for its UnRAR-derived engine. That restriction permits software to handle RAR
archives but prohibits using the code to develop a RAR/WinRAR-compatible archiver
or recreate the proprietary compression algorithm. WT Content Manager only
reads and extracts RAR archives; it does not create them.

The full license and restriction are included in
`src-tauri/licenses/UNRAR-RS-LICENSE.txt`, and the required restriction notice
also appears in the source comments of `src-tauri/src/skins/archive/rar.rs`.
Any binary distribution must include the full license file.
