#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod watcher;

use tauri::{LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

const WINDOW_WIDTH: f64 = 420.0;
const WINDOW_HEIGHT: f64 = 640.0;
const SCREEN_MARGIN: f64 = 16.0;

fn bottom_right_of_primary_display(app: &tauri::App) -> Option<LogicalPosition<f64>> {
    let monitor = app.primary_monitor().ok()??;
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let origin = area.position.to_logical::<f64>(scale);
    let size = area.size.to_logical::<f64>(scale);
    Some(LogicalPosition::new(
        origin.x + size.width - WINDOW_WIDTH - SCREEN_MARGIN,
        origin.y + size.height - WINDOW_HEIGHT - SCREEN_MARGIN,
    ))
}

fn create_overlay(app: &tauri::App) -> tauri::Result<()> {
    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("Aion 2 Pet Tracker")
        .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
        .resizable(false)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .focused(false);
    if let Some(position) = bottom_right_of_primary_display(app) {
        builder = builder.position(position.x, position.y);
    }
    let window = builder.build()?;

    window.set_ignore_cursor_events(true)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        // A second app would run a second watcher and show every soul twice.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(watcher::Watcher::default())
        .invoke_handler(tauri::generate_handler![
            watcher::watcher_start,
            watcher::watcher_diagnose,
        ])
        .setup(|app| {
            create_overlay(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the app")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                app.state::<watcher::Watcher>().stop();
            }
        });
}
