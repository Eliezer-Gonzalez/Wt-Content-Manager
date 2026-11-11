use crate::{skins::recovery::lock_game_filesystem, AppError};

use super::{ensure_game_stopped, journal, recovery, validated_game_root};
use crate::sounds::{
    files::{directory_has_content, sound_mod_path},
    types::SoundInstallPreflight,
};

pub fn install_preflight(
    app_data_dir: &std::path::Path,
    game_path: &str,
) -> Result<SoundInstallPreflight, AppError> {
    let game_root = validated_game_root(game_path)?;
    let _mutation = lock_game_filesystem();
    ensure_game_stopped(&game_root)?;
    recovery::recover_pending(app_data_dir, &game_root)?;
    let target = sound_mod_path(&game_root)?;
    let paths = journal::storage_paths(app_data_dir, &game_root);
    if let Some(state) = journal::read_state(&paths)? {
        if state.game_root != game_root.to_string_lossy() {
            return Err(AppError::new("sound_install_state_invalid"));
        }
        return Ok(SoundInstallPreflight {
            existing_content: false,
        });
    }
    let existing_content = target.is_dir() && directory_has_content(&target)?;
    Ok(SoundInstallPreflight { existing_content })
}
