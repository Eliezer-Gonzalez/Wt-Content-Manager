use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{self, Read};
use std::path::Path;
use zip::{ZipArchive, ZipReadOptions};

use super::ExtractStats;
use crate::skins::paths::{
    check_archive_entry_allowed, safe_archive_path, ArchiveEntryFilter, MAX_ARCHIVE_ENTRIES,
    MAX_ENTRY_BYTES,
};

pub fn extract(
    archive_path: &Path,
    destination: &Path,
    size_limit: u64,
) -> Result<ExtractStats, String> {
    let file = fs::File::open(archive_path).map_err(|error| error.to_string())?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("No se pudo abrir el ZIP: {error}"))?;
    if archive.is_empty() {
        return Err("El ZIP está vacío o contiene demasiados archivos.".into());
    }

    let mut written_paths = HashSet::new();
    let mut total_written = 0_u64;
    let mut stats = ExtractStats::default();

    for index in 0..archive.len() {
        let options = ZipReadOptions::new().enforce_header_consistency(true);
        let entry = archive
            .by_index_with_options(index, options)
            .map_err(|error| format!("No se pudo leer un archivo del ZIP: {error}"))?;
        if entry.is_symlink() {
            return Err(
                "La skin ZIP contiene un enlace simbólico y se rechazó por seguridad.".into(),
            );
        }
        let mode = entry.unix_mode().unwrap_or_default() & 0o170000;
        if mode != 0 && mode != 0o100000 && mode != 0o040000 {
            return Err("La skin ZIP contiene un tipo de archivo especial.".into());
        }
        let raw_name = entry
            .name()
            .map_err(|error| error.to_string())?
            .into_owned();
        let relative = safe_archive_path(&raw_name)?;
        let output = destination.join(&relative);
        if entry.is_dir() {
            fs::create_dir_all(&output).map_err(|error| error.to_string())?;
            continue;
        }

        match check_archive_entry_allowed(&relative) {
            ArchiveEntryFilter::Allowed => {}
            ArchiveEntryFilter::DisallowedExecutable => {
                stats.skipped_files += 1;
                stats.skipped_executables += 1;
                continue;
            }
            ArchiveEntryFilter::DisallowedOther => {
                stats.skipped_files += 1;
                continue;
            }
        }

        stats.extracted_files += 1;
        if stats.extracted_files > MAX_ARCHIVE_ENTRIES {
            return Err("La skin ZIP supera los límites de extracción permitidos.".into());
        }

        let expected = entry.size();
        if expected > MAX_ENTRY_BYTES || total_written.saturating_add(expected) > size_limit {
            return Err("La skin ZIP supera los límites de extracción permitidos.".into());
        }
        if !written_paths.insert(output.clone()) {
            return Err("El ZIP contiene rutas duplicadas o en conflicto.".into());
        }
        let parent = output
            .parent()
            .ok_or_else(|| "Ruta ZIP no válida.".to_string())?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let mut target = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)
            .map_err(|error| format!("No se pudo extraer un archivo de la skin: {error}"))?;
        let remaining = size_limit.saturating_sub(total_written);
        let copied = io::copy(&mut entry.take(remaining.saturating_add(1)), &mut target)
            .map_err(|error| format!("Falló la extracción del ZIP: {error}"))?;
        if copied > remaining || copied != expected {
            return Err(
                "El contenido del ZIP supera el tamaño declarado o los límites permitidos.".into(),
            );
        }
        total_written += copied;
    }
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::extract;
    use crate::skins::paths::contains_skin_definition;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn build_test_zip(entries: &[(&str, &[u8])]) -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut zip = ZipWriter::new(File::create(file.path()).unwrap());
        let options = SimpleFileOptions::default();
        for (name, content) in entries {
            zip.start_file(*name, options).unwrap();
            zip.write_all(content).unwrap();
        }
        zip.finish().unwrap();
        file
    }

    #[test]
    fn extracts_allowed_files_and_skips_disallowed() {
        let zip_file = build_test_zip(&[
            ("skin.blk", b"set_skin {}"),
            ("diffuse.DDS", b"dds_content"),
            ("notes.txt", b"notes"),
            ("payload.exe", b"binary"),
            ("setup.BAT", b"@echo off"),
            ("LICENSE", b"mit license"),
            ("nested/texture.tga", b"tga_bytes"),
        ]);
        let dest = tempdir().unwrap();
        let stats = extract(zip_file.path(), dest.path(), 10 * 1024 * 1024).unwrap();

        assert_eq!(stats.extracted_files, 4); // skin.blk, diffuse.DDS, notes.txt, nested/texture.tga
        assert_eq!(stats.skipped_files, 3); // payload.exe, setup.BAT, LICENSE
        assert_eq!(stats.skipped_executables, 2); // payload.exe, setup.BAT

        assert!(dest.path().join("skin.blk").is_file());
        assert!(dest.path().join("diffuse.DDS").is_file());
        assert!(dest.path().join("notes.txt").is_file());
        assert!(dest.path().join("nested/texture.tga").is_file());

        assert!(!dest.path().join("payload.exe").exists());
        assert!(!dest.path().join("setup.BAT").exists());
        assert!(!dest.path().join("LICENSE").exists());

        assert!(contains_skin_definition(dest.path()).unwrap());
    }

    #[test]
    fn archive_with_only_disallowed_files_has_no_skin_definition() {
        let zip_file = build_test_zip(&[
            ("malicious.exe", b"exe data"),
            ("trojan.dll", b"dll data"),
            ("noextension", b"unknown"),
        ]);
        let dest = tempdir().unwrap();
        let stats = extract(zip_file.path(), dest.path(), 10 * 1024 * 1024).unwrap();

        assert_eq!(stats.extracted_files, 0);
        assert_eq!(stats.skipped_files, 3);
        assert_eq!(stats.skipped_executables, 2);
        assert!(!contains_skin_definition(dest.path()).unwrap());
    }
}
