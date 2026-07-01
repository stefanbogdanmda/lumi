// Lumi Overlay — Tauri v2 native window that frames the bundled `lumi-serve` sidecar.
//
// Responsibilities of this thin shell:
//   1. Start the bundled `lumi-serve` sidecar (a self-contained exe — no Node on the
//      user's machine) on 127.0.0.1:OVERLAY_PORT, unless a server is already running.
//   2. Wait until the server answers, then reveal the decorated always-on-top window.
//   3. Kill the sidecar when the window/app closes.

use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Port the Lumi web overlay listens on. MUST match `@lumi/core`'s default
/// (see core/src/cli.ts serve → 4321) and the port passed to the sidecar below.
const OVERLAY_PORT: u16 = 4321;

/// Holds the spawned sidecar child so it can be killed on exit.
/// `None` means we did not start it (already running, or spawn failed).
#[derive(Default)]
struct ServerProcess(Mutex<Option<CommandChild>>);

fn overlay_addr() -> SocketAddr {
    (std::net::Ipv4Addr::LOCALHOST, OVERLAY_PORT).into()
}

/// True if something is already listening on the overlay port. A listening
/// socket means the Node http server is up (routes are registered synchronously
/// before `listen()`), so this doubles as a readiness check — no HTTP client needed.
fn port_is_open() -> bool {
    TcpStream::connect_timeout(&overlay_addr(), Duration::from_millis(250)).is_ok()
}

/// Spawn the bundled `lumi-serve` sidecar. Returns the child so we can kill it.
fn spawn_sidecar(app: &tauri::AppHandle) -> Option<CommandChild> {
    match app.shell().sidecar("lumi-serve") {
        Ok(cmd) => match cmd.args(["--port", &OVERLAY_PORT.to_string()]).spawn() {
            Ok((mut _rx, child)) => {
                println!(
                    "[lumi-overlay] started lumi-serve sidecar --port {OVERLAY_PORT} (pid {})",
                    child.pid()
                );
                Some(child)
            }
            Err(e) => {
                eprintln!("[lumi-overlay] failed to spawn lumi-serve sidecar: {e}");
                None
            }
        },
        Err(e) => {
            eprintln!("[lumi-overlay] lumi-serve sidecar not found: {e}");
            None
        }
    }
}

/// Block until the overlay server answers, or ~15s elapse. We reveal the window
/// either way; the loading page (src/index.html) also retries on its own.
fn wait_for_server() {
    const MAX_TRIES: u32 = 60; // 60 * 250ms = 15s
    for _ in 0..MAX_TRIES {
        if port_is_open() {
            return;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    eprintln!(
        "[lumi-overlay] timed out waiting for http://127.0.0.1:{OVERLAY_PORT}; showing window anyway."
    );
}

/// Best-effort: kill the spawned sidecar, if any. Idempotent.
fn kill_server(state: &ServerProcess) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(child) = guard.take() {
            let _ = child.kill();
            println!("[lumi-overlay] stopped lumi-serve sidecar");
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess::default())
        .setup(|app| {
            // Only start a server if one isn't already up (avoids clashing with a
            // dev instance the user launched with `lumi serve`).
            if !port_is_open() {
                if let Some(child) = spawn_sidecar(&app.handle()) {
                    if let Ok(mut guard) = app.state::<ServerProcess>().0.lock() {
                        *guard = Some(child);
                    }
                }
            }

            // Reveal the window once the overlay is reachable, off the main thread.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                wait_for_server();
                if let Some(win) = handle.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(
                event,
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
            ) {
                kill_server(&window.state::<ServerProcess>());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Lumi Overlay")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                kill_server(&app_handle.state::<ServerProcess>());
            }
        });
}
