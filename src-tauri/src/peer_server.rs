use tauri::async_runtime::spawn;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde_json::{json, Value};
use futures_util::SinkExt;
use uuid;

#[derive(Clone)]
struct Client {
    id: String,
    sender: Arc<Mutex<futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
        tokio_tungstenite::tungstenite::Message,
    >>>,
}

struct PeerServer {
    clients: Arc<Mutex<HashMap<String, Client>>>,
}

impl PeerServer {
    fn new() -> Self {
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn broadcast(&self, message: &str, exclude_id: Option<&str>) {
        let clients = self.clients.lock().await;
        for (id, client) in clients.iter() {
            if let Some(exclude) = exclude_id {
                if id == exclude {
                    continue;
                }
            }
            if let Err(e) = client.sender.lock().await
                .send(tokio_tungstenite::tungstenite::Message::Text(message.to_string())).await {
                println!("Ошибка отправки: {}", e);
            }
        }
    }

    async fn handle_message(&self, text: String, client_id: &str) -> Result<(), String> {
        if let Ok(json) = serde_json::from_str::<Value>(&text) {
            match json.get("type").and_then(|t| t.as_str()) {
                Some("announce") => {
                    // Отправляем информацию о пире
                    let response = json!({
                        "type": "peer_info",
                        "peer_id": client_id,
                        "data": json.get("data")
                    });
                    self.broadcast(&response.to_string(), Some(client_id)).await;
                },
                Some("offer") => {
                    if let Some(target) = json.get("target").and_then(|t| t.as_str()) {
                        let clients = self.clients.lock().await;
                        if let Some(target_client) = clients.get(target) {
                            let message = json!({
                                "type": "offer",
                                "from": client_id,
                                "data": json.get("data").unwrap()
                            }).to_string();
                            
                            if let Err(e) = target_client.sender.lock().await
                                .send(tokio_tungstenite::tungstenite::Message::Text(message)).await {
                                println!("Ошибка отправки offer: {}", e);
                            }
                        }
                    }
                },
                Some("answer") => {
                    // Аналогично обработке offer
                    if let Some(target) = json.get("target").and_then(|t| t.as_str()) {
                        let clients = self.clients.lock().await;
                        if let Some(target_client) = clients.get(target) {
                            let message = json!({
                                "type": "answer",
                                "from": client_id,
                                "data": json.get("data").unwrap()
                            }).to_string();
                            
                            if let Err(e) = target_client.sender.lock().await
                                .send(tokio_tungstenite::tungstenite::Message::Text(message)).await {
                                println!("Ошибка отправки answer: {}", e);
                            }
                        }
                    }
                },
                Some("get_peers") => {
                    // Отправляем список всех активных пиров
                    let clients = self.clients.lock().await;
                    let peer_list: Vec<String> = clients.values()
                        .map(|client| client.id.clone())
                        .collect();
                    
                    let response = json!({
                        "type": "peer_list",
                        "peers": peer_list
                    });

                    // Отправляем только запросившему клиенту
                    if let Some(requesting_client) = clients.get(client_id) {
                        if let Err(e) = requesting_client.sender.lock().await
                            .send(tokio_tungstenite::tungstenite::Message::Text(response.to_string())).await {
                            println!("Ошибка отправки списка пиров: {}", e);
                        }
                    }
                },
                _ => println!("Неизвестный тип сообщения")
            }
        }
        Ok(())
    }
}


pub async fn start_peer_server() -> Result<String, String> {
    let server = PeerServer::new();
    let server = Arc::new(server);

    spawn(async move {
        let addr = "0.0.0.0:8080";
        let listener = TcpListener::bind(&addr).await.expect("Не удалось запустить сервер");
        println!("Сервер запущен на {}", addr);

        while let Ok((stream, _)) = listener.accept().await {
            let peer = accept_async(stream).await.expect("Ошибка при установке WebSocket соединения");
            let (sender, mut receiver) = peer.split();
            
            let client_id = uuid::Uuid::new_v4().to_string();
            let client = Client {
                id: client_id.clone(),
                sender: Arc::new(Mutex::new(sender))
            };

            let server_clone = server.clone();
            
            {
                let mut clients = server.clients.lock().await;
                clients.insert(client_id.clone(), client);
            }

            // Отправляем уведомление о новом подключении
            server.broadcast(&json!({
                "type": "peer_connected",
                "peer_id": client_id
            }).to_string(), None).await;

            spawn(async move {
                while let Some(msg) = receiver.next().await {
                    if let Ok(msg) = msg {
                        if let tokio_tungstenite::tungstenite::Message::Text(text) = msg {
                            if let Err(e) = server_clone.handle_message(text, &client_id).await {
                                println!("Ошибка обработки сообщения: {}", e);
                            }
                        }
                    }
                }
                
                // Клиент отключился
                let mut clients = server_clone.clients.lock().await;
                clients.remove(&client_id);
                
                server_clone.broadcast(&json!({
                    "type": "peer_disconnected",
                    "peer_id": client_id
                }).to_string(), None).await;
            });
        }
    });

    Ok("Сервер запущен".to_string())
}