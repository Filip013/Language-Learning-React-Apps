#[tauri::command]
async fn start_auth_server() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:51730").map_err(|e| e.to_string())?;
        
        // Wait up to 5 minutes for the user to log in
        listener.set_read_timeout(Some(std::time::Duration::from_secs(300))).ok();
        
        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    let mut buffer = [0; 1024];
                    if let Ok(size) = stream.read(&mut buffer) {
                        let request = String::from_utf8_lossy(&buffer[..size]);
                        if let Some(token) = request.lines().next().and_then(|line| {
                            if line.starts_with("GET /?token=") {
                                line.strip_prefix("GET /?token=").and_then(|s| s.split_whitespace().next())
                            } else {
                                None
                            }
                        }) {
                            let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><head><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;text-align:center;}</style></head><body><div><h2>🎉 Authentication Successful!</h2><p>You can close this tab and return to LingoHub.</p></div><script>setTimeout(()=>window.close(), 2000);</script></body></html>";
                            let _ = stream.write_all(response.as_bytes());
                            return Ok(token.to_string());
                        }
                    }
                }
                Err(e) => return Err(e.to_string()),
            }
        }
        Err("Server shut down".to_string())
    }).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![start_auth_server])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
