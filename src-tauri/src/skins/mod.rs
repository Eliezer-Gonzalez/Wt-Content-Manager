mod archive;
mod archive_paths;
pub(crate) mod download;
pub mod download_task;
mod install;
mod install_staging;
pub mod library;
pub(crate) mod paths;
pub(crate) mod recovery;
mod replacement;
mod staging;
mod texture_validation;

pub use library::{scan_installed_skins, uninstall_skin, ScannedSkin};
pub use staging::{
    cleanup_orphan_staging, inspect_orphan_staging, is_orphan_staging_dir, register_active_staging,
    unregister_active_staging, TemporaryCleanupOutcome, TemporaryFileReport,
    DEFAULT_ORPHAN_AGE_THRESHOLD, STAGING_PREFIX, STAGING_SUFFIX_LEN,
};

pub use install::{install_skin, InstallResult};
