use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GameProcessStatus {
    Running,
    Stopped,
    Unknown,
}

pub fn status(game_root: &Path) -> GameProcessStatus {
    let executables = [
        game_root.join("win64").join("aces.exe"),
        game_root.join("aces.exe"),
    ]
    .into_iter()
    .filter(|path| path.is_file())
    .collect::<Vec<_>>();
    if executables.is_empty() {
        return GameProcessStatus::Unknown;
    }
    for executable in executables {
        match running_image(&executable) {
            Ok(true) => return GameProcessStatus::Running,
            Ok(false) => {}
            Err(()) => return GameProcessStatus::Unknown,
        }
    }
    GameProcessStatus::Stopped
}

#[cfg(windows)]
fn running_image(expected: &Path) -> Result<bool, ()> {
    use std::ffi::OsString;
    use std::mem::size_of;
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    let expected = std::fs::canonicalize(expected).map_err(|_| ())?;
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return Err(());
    }

    let result = unsafe {
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        let mut has_entry = Process32FirstW(snapshot, &mut entry) != 0;
        let mut found = false;
        while has_entry {
            let name = String::from_utf16_lossy(&entry.szExeFile);
            if name.trim_end_matches('\0').eq_ignore_ascii_case("aces.exe") {
                let process =
                    OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, entry.th32ProcessID);
                if process.is_null() {
                    CloseHandle(snapshot);
                    return Err(());
                }
                let mut buffer = vec![0_u16; 32_768];
                let mut length = buffer.len() as u32;
                let queried =
                    QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length);
                CloseHandle(process);
                if queried == 0 {
                    CloseHandle(snapshot);
                    return Err(());
                }
                let actual = PathBuf::from(OsString::from_wide(&buffer[..length as usize]));
                if normalized(&actual) == normalized(&expected) {
                    found = true;
                    break;
                }
            }
            has_entry = Process32NextW(snapshot, &mut entry) != 0;
        }
        CloseHandle(snapshot);
        Ok(found)
    };
    result
}

#[cfg(not(windows))]
fn running_image(_expected: &Path) -> Result<bool, ()> {
    Err(())
}

#[cfg(windows)]
fn normalized(path: &Path) -> String {
    let path = path.to_string_lossy().replace('/', "\\");
    let path = if let Some(unc) = path.strip_prefix("\\\\?\\UNC\\") {
        format!("\\\\{unc}")
    } else if let Some(plain) = path.strip_prefix("\\\\?\\") {
        plain.to_owned()
    } else {
        path
    };
    path.to_lowercase()
}

#[cfg(all(test, windows))]
mod tests {
    use super::normalized;
    use std::path::Path;

    #[test]
    fn normalizes_verbatim_windows_paths() {
        assert_eq!(
            normalized(Path::new(r"\\?\C:\Games\WT\aces.exe")),
            r"c:\games\wt\aces.exe"
        );
        assert_eq!(
            normalized(Path::new(r"\\?\UNC\server\share\aces.exe")),
            r"\\server\share\aces.exe"
        );
    }
}
