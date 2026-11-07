# Third-party notices

## ZIP support

ZIP extraction uses the Rust `zip` crate, licensed under MIT. See the crate's
license at <https://github.com/zip-rs/zip2/blob/master/LICENSE>.

## RAR support

RAR extraction uses `unrar-rs`, licensed under Apache-2.0 with an additional
condition for its UnRAR-derived engine. The full license and condition are
included in `src-tauri/licenses/UNRAR-RS-LICENSE.txt`. WT Content Manager only
reads and extracts RAR archives; it does not create them.
