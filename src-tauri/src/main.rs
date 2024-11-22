// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
async fn start_peer_server() -> Result<(), String> {
    // Ваша логика запуска сервера
    println!("Запуск сервера");
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_peer_server,
            // другие команды...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
