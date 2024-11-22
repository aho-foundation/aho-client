mod peer_server;
mod discovery;

use std::sync::Arc;
use tokio::sync::Mutex;

// Глобальное состояние для Discovery
struct AppState {
    discovery: Arc<Mutex<discovery::Discovery>>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn find_local_server(state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.discovery.lock().await.find_server().await {
        Ok(server) => Ok(server),
        Err(e) => {
            println!("Ошибка поиска сервера: {}", e);
            Ok("ws://localhost:8080".to_string()) // Фоллбэк на локальный адрес
        }
    }
}

#[tauri::command]
async fn start_peer_server(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let discovery_clone = state.discovery.clone();
    
    tokio::spawn({
        async move {
            if let Err(e) = discovery_clone.lock().await.broadcast_server().await {
                println!("Ошибка broadcast: {}", e); // Логируем ошибку и продолжаем работу
            }
        }
    });

    match peer_server::start_peer_server().await {
        Ok(result) => Ok(result),
        Err(e) => {
            println!("Ошибка запуска сервера: {}", e);
            Ok("Сервер запущен с ошибками".to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            discovery: Arc::new(Mutex::new(discovery::Discovery::new().unwrap()))
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            find_local_server,
            start_peer_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
