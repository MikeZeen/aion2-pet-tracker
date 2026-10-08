//! Runs the packet watcher (scripts/watcher.py) and forwards its JSON lines to the frontend.

use std::io::{BufRead, BufReader, Read};
use std::os::windows::process::CommandExt;
use std::process::{Child, Command, Output, Stdio};
use std::sync::Mutex;
use std::thread;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

const EVENT: &str = "watcher:event";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// The running watcher. The generation tells an exit of the current process
/// apart from one that was stopped or replaced meanwhile.
#[derive(Default)]
pub struct Watcher(Mutex<Live>);

#[derive(Default)]
struct Live {
    generation: u64,
    child: Option<Child>,
    /// The last zone event. The game sends the map id only on a map change,
    /// so a restarted watcher (e.g. after the frontend reloads) is told it again.
    zone: Option<Value>,
}

impl Watcher {
    pub fn stop(&self) {
        let child = self.0.lock().unwrap().child.take();
        if let Some(mut child) = child {
            kill_tree(&child);
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    fn replace(&self, child: Child) -> u64 {
        let mut live = self.0.lock().unwrap();
        live.generation += 1;
        live.child = Some(child);
        live.generation
    }

    fn last_zone(&self) -> Option<Value> {
        self.0.lock().unwrap().zone.clone()
    }

    fn remember_zone(&self, zone: &Value) {
        self.0.lock().unwrap().zone = Some(zone.clone());
    }

    fn take_if_current(&self, generation: u64) -> Option<Child> {
        let mut live = self.0.lock().unwrap();
        if live.generation == generation {
            live.child.take()
        } else {
            None
        }
    }
}

// The PyInstaller exe runs the watcher in a child process that kill() alone leaves running.
fn kill_tree(child: &Child) {
    let _ = Command::new("taskkill")
        .args(["/PID", &child.id().to_string(), "/T", "/F"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

// Debug builds run watcher.py through Python; release builds use watcher.exe next to the app.
#[cfg(debug_assertions)]
fn command() -> Command {
    let python = std::env::var("AION2_PYTHON").unwrap_or_else(|_| "python".into());
    let mut cmd = Command::new(python);
    cmd.arg(concat!(env!("CARGO_MANIFEST_DIR"), "/../scripts/watcher.py"));
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(debug_assertions))]
fn command() -> Command {
    let exe = std::env::current_exe()
        .ok()
        .and_then(|path| Some(path.parent()?.join("watcher.exe")))
        .unwrap_or_else(|| "watcher.exe".into());
    let mut cmd = Command::new(exe);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

fn run_to_end(args: &[&str]) -> std::io::Result<Output> {
    command().args(args).stdin(Stdio::null()).output()
}

fn emit_error(app: &AppHandle, message: String) {
    let _ = app.emit(EVENT, json!({ "type": "error", "message": message }));
}

#[tauri::command]
pub fn watcher_start(app: AppHandle, watcher: State<'_, Watcher>, character: String, iface: Option<String>) {
    watcher.stop();

    let mut args = vec!["--character".to_string(), character];
    if let Some(iface) = iface.filter(|iface| !iface.is_empty()) {
        args.push("--iface".into());
        args.push(iface);
    }

    let spawned = command()
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    let mut child = match spawned {
        Ok(child) => child,
        Err(err) => return emit_error(&app, err.to_string()),
    };
    let stdout = child.stdout.take().expect("stdout is piped");
    let mut stderr = child.stderr.take().expect("stderr is piped");
    let generation = watcher.replace(child);
    if let Some(zone) = watcher.last_zone() {
        let _ = app.emit(EVENT, zone);
    }

    let stderr_reader = thread::spawn(move || {
        let mut text = String::new();
        let _ = stderr.read_to_string(&mut text);
        text
    });

    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(payload) = serde_json::from_str::<Value>(&line) {
                if payload["type"] == "zone" {
                    app.state::<Watcher>().remember_zone(&payload);
                }
                let _ = app.emit(EVENT, payload);
            }
        }
        let stderr = stderr_reader.join().unwrap_or_default();

        let Some(mut child) = app.state::<Watcher>().take_if_current(generation) else {
            return;
        };
        let Ok(status) = child.wait() else { return };
        if !status.success() {
            let stderr = stderr.trim();
            emit_error(
                &app,
                if stderr.is_empty() {
                    format!("watcher exited with code {}", status.code().unwrap_or(-1))
                } else {
                    stderr.to_string()
                },
            );
        }
    });
}

/// Listens on every adapter for a while and reports where game traffic shows up.
#[tauri::command]
pub async fn watcher_diagnose() -> String {
    tauri::async_runtime::spawn_blocking(|| {
        let output = match run_to_end(&["--diagnose"]) {
            Ok(output) => output,
            Err(err) => return format!("Couldn't run the watcher: {err}"),
        };
        let report = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| serde_json::from_str::<Value>(line).ok())
            .find(|event| event["type"] == "diagnostics")
            .and_then(|event| event["text"].as_str().map(String::from));
        report.unwrap_or_else(|| {
            let stderr = String::from_utf8_lossy(&output.stderr);
            format!("The diagnostics didn't finish.\n{}", stderr.trim())
        })
    })
    .await
    .unwrap_or_else(|err| err.to_string())
}
