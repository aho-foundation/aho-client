use std::net::UdpSocket;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Serialize, Deserialize};

const DISCOVERY_PORT: u16 = 35500;
const SERVER_PORT: u16 = 8080;

#[derive(Serialize, Deserialize)]
struct DiscoveryMessage {
    kind: String,
    server_port: u16,
}

pub struct Discovery {
    socket: Arc<Mutex<UdpSocket>>,
}

impl Discovery {
    pub fn new() -> std::io::Result<Self> {
        let socket = UdpSocket::bind("0.0.0.0:0")?;
        socket.set_broadcast(true)?;
        
        Ok(Self {
            socket: Arc::new(Mutex::new(socket)),
        })
    }

    pub async fn broadcast_server(&self) -> std::io::Result<()> {
        let message = DiscoveryMessage {
            kind: "server-announce".to_string(),
            server_port: SERVER_PORT,
        };
        
        let data = serde_json::to_string(&message)?;
        let socket = self.socket.lock().await;
        
        loop {
            socket.send_to(
                data.as_bytes(),
                format!("255.255.255.255:{}", DISCOVERY_PORT)
            )?;
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    }

    pub async fn find_server(&self) -> Result<String, String> {
        let socket = UdpSocket::bind(format!("0.0.0.0:{}", DISCOVERY_PORT))
            .map_err(|e| format!("Ошибка привязки сокета: {}", e))?;
        
        let mut buf = [0u8; 1024];
        // Установим таймаут на поиск
        tokio::select! {
            result = async {
                loop {
                    match socket.recv_from(&mut buf) {
                        Ok((size, addr)) => {
                            if let Ok(message) = serde_json::from_slice::<DiscoveryMessage>(&buf[..size]) {
                                if message.kind == "server-announce" {
                                    return Ok(format!("ws://{}:{}", addr.ip(), message.server_port));
                                }
                            }
                        }
                        Err(e) => {
                            println!("Ошибка получения данных: {}", e);
                            continue;
                        }
                    }
                }
            } => result,
            
            // Таймаут 3 секунды
            _ = tokio::time::sleep(std::time::Duration::from_secs(3)) => {
                Err("Таймаут поиска сервера".to_string())
            }
        }
    }
}