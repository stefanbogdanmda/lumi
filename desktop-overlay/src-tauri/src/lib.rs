// Lumi Overlay — Tauri v2 native window that frames the `lumi serve` web overlay.
//
// AUTHORED, NOT COMPILED: this file was written without a Rust toolchain available.
// The API calls target Tauri v2. Verify with `npm run tauri dev` after installing Rust.
//
// Responsibilities of this thin shell:
//   1. Start `lumi serve` (the web overlay on 127.0.0.1:4321) as a child process,
//      unless one is already running.
//   2. Wait until that server answers, then reveal the decorated always-on-top window.
//   3. Kill the server child when the window/app closes.
//
// All real UI lives in the web overlay served by `lumi serve`; this crate only owns
// the native window chrome and process lifecycle.

use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, WindowEvent};

/// Port the Lumi web overlay listens on. MUST match `@lumi/core`'s `lumi serve`
/// default (see core/src/cli.ts -> `case "serve"`, default 4321).
const OVERLAY_PORT: u16 = 4321;

/// Holds the spawned `lumi serve` child so it can be killed on exit.
/// `None` means we did not start it (already running, or spawn failed).
#[derive(Default)]
struct ServerProcess(Mutex<Option<Child>>);

fn overlay_addr() -> SocketAddr {
    (std::net::Ipv4Addr::LOCALHOST, OVERLAY_PORT).into()
}

/// True if something is already listening on the overlay port.
fn port_is_open() -> bool {
    TcpStream::connect_timeout(&overlay_addr(), Duration::from_millis(250)).is_ok()
}

/// Start `lumi serve` as a child process, returning the handle so we can kill it.
///
/// Resolution order:
///   1. `LUMI_SERVE_JS` env var  -> `node <that> serve`        (explicit override)
///   2. Monorepo `core/dist/cli-bin.js` resolved at COMPILE TIME relative to this
///      crate -> `node <path> serve`  (preferred: node is a direct child, so a
///      kill actually stops the server)
///   3. `lumi serve` via the platform shell (PATH-shim fallback; on Windows the
///      direct child is cmd.exe, so the node grandchild may outlive a kill —
///      last resort only)
fn spawn_lumi_serve() -> Option<Child> {
    if let Ok(js) = std::env::var("LUMI_SERVE_JS") {
        if let Some(child) = spawn_node_script(&js) {
            return Some(child);
        }
    }

    // <crate>/../../core/dist/cli-bin.js  ==  <repo-root>/core/dist/cli-bin.js
    let bundled = concat!(env!("CARGO_MANIFEST_DIR"), "/../../core/dist/cli-bin.js");
    if Path::new(bundled).exists() {
        if let Some(child) = spawn_node_script(bundled) {
            return Some(child);
        }
    }

    spawn_via_shell()
}

fn spawn_node_script(script: &str) -> Option<Child> {
    match Command::new("node")
        .arg(script)
        .arg("serve")
        .arg("--port")
        .arg(OVERLAY_PORT.to_string())
        .spawn()
    {
        Ok(child) => {
            println!(
                "[lumi-overlay] started `node {script} serve --port {OVERLAY_PORT}` (pid {})",
                child.id()
            );
            Some(child)
        }
        Err(e) => {
            eprintln!("[lumi-overlay] failed to run `node {script} serve`: {e}");
            None
        }
    }
}

fn spawn_via_shell() -> Option<Child> {
    let cmdline = format!("lumi serve --port {OVERLAY_PORT}");

    #[cfg(target_os = "windows")]
    let result = Command::new("cmd").arg("/C").arg(&cmdline).spawn();
    #[cfg(not(target_os = "windows"))]
    let result = Command::new("sh").arg("-c").arg(&cmdline).spawn();

    match result {
        Ok(child) => {
            println!("[lumi-overlay] started `{cmdline}` via shell (pid {})", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!(
                "[lumi-overlay] could not start `lumi serve`: {e}. \
                 Start it manually in another terminal: `lumi serve` (port {OVERLAY_PORT})."
            );
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
        "[lumi-overlay] timed out waiting for http://127.0.0.1:{OVERLAY_PORT}; \
         showing window anyway."
    );
}

/// Best-effort: kill the spawned server child, if any. Idempotent.
fn kill_server(state: &ServerProcess) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
            println!("[lumi-overlay] stopped lumi serve");
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(ServerProcess::default())
        .setup(|app| {
            // Only start a server if one isn't already up (avoids EADDRINUSE noise
            // when the user already ran `lumi serve` themselves).
            if !port_is_open() {
                if let Some(child) = spawn_lumi_serve() {
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
            // Belt-and-suspenders: also stop the server on full app exit.
            if let RunEvent::Exit = event {
                kill_server(&app_handle.state::<ServerProcess>());
            }
        });
}
