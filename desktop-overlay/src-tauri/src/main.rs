// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// All app logic lives in the library crate (canonical Tauri v2 layout, mobile-ready).
fn main() {
    lumi_overlay_lib::run();
}
