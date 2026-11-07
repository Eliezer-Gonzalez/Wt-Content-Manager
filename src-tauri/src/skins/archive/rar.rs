// UnRAR source code may be used in any software to handle
// RAR archives without limitations free of charge, but cannot be
// used to develop RAR (WinRAR) compatible archiver and to
// re-create RAR compression algorithm, which is proprietary.
// Distribution of modified UnRAR source code in separate form or as a part
// of other software is permitted, provided that full text of this paragraph
// from “UnRAR source code” is included in the license or documentation and
// in source code comments of the resulting package.

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::path::Path;
use unrar_rs::{Limits, RarArchive};

use crate::skins::paths::{safe_archive_path, MAX_ARCHIVE_ENTRIES, MAX_ENTRY_BYTES};

pub fn extract(archive_path: &Path, destination: &Path, size_limit: u64) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|error| error.to_string())?;
    let mut archive =
        RarArchive::open(file).map_err(|error| format!("No se pudo abrir el RAR: {error}"))?;
    archive.set_limits(Limits {
        max_data_segment: MAX_ENTRY_BYTES,
        max_unpacked_size: MAX_ENTRY_BYTES,
        ..Limits::default()
    });
    if archive.is_empty() || archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err("El RAR está vacío o contiene demasiados archivos.".into());
    }

    let members = archive.entries().collect::<Vec<_>>();
    let mut total_declared = 0_u64;
    let mut paths = Vec::with_capacity(members.len());
    let mut written_paths = HashSet::new();
    for member in &members {
        if member.is_symlink || member.is_hardlink || member.is_file_copy {
            return Err(
                "La skin RAR contiene enlaces de archivo y se rechazó por seguridad.".into(),
            );
        }
        let relative = safe_archive_path(&member.name)?;
        if !member.is_directory {
            let size = member
                .unpacked_size
                .ok_or_else(|| "El RAR no declara el tamaño de un archivo.".to_string())?;
            total_declared = total_declared
                .checked_add(size)
                .ok_or_else(|| "El tamaño declarado del RAR no es válido.".to_string())?;
            if size > MAX_ENTRY_BYTES || total_declared > size_limit {
                return Err("La skin RAR supera los límites de extracción permitidos.".into());
            }
            if !written_paths.insert(relative.clone()) {
                return Err("El RAR contiene rutas duplicadas o en conflicto.".into());
            }
        }
        paths.push((relative, member.is_directory));
    }

    for (index, (relative, is_directory)) in paths.into_iter().enumerate() {
        let output = destination.join(relative);
        if is_directory {
            fs::create_dir_all(&output).map_err(|error| error.to_string())?;
            continue;
        }
        let parent = output
            .parent()
            .ok_or_else(|| "Ruta RAR no válida.".to_string())?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let mut target = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)
            .map_err(|error| format!("No se pudo extraer un archivo de la skin: {error}"))?;
        archive
            .by_index(index)
            .map_err(|error| format!("No se pudo leer un archivo del RAR: {error}"))?
            .copy_to(&mut target)
            .map_err(|error| format!("Falló la extracción del RAR: {error}"))?;
    }
    Ok(())
}
