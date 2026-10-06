// Exposes window.aion2Watcher and window.aion2Overlay inside the desktop app.
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window'
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { openUrl } from '@tauri-apps/plugin-opener'
import { DEV_TOOLS } from './devTools'

const MODE_SHORTCUT = 'CommandOrControl+Shift+M'
const TEST_TOAST_SHORTCUT = 'CommandOrControl+Shift+T'

// Must match WINDOW_WIDTH/HEIGHT in main.rs.
const BASE_WIDTH = 420
const BASE_HEIGHT = 640
const SCREEN_MARGIN = 16

function subscribe(listeners, callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function installBridge() {
  const appWindow = getCurrentWindow()
  const modeListeners = new Set()
  const testToastListeners = new Set()
  let mode = 'toast'

  // 'toast': click-through overlay. 'settings': interactive window.
  async function setMode(next) {
    mode = next === 'settings' ? 'settings' : 'toast'
    await appWindow.setIgnoreCursorEvents(mode === 'toast')
    if (mode === 'settings') {
      if (await appWindow.isMinimized()) await appWindow.unminimize()
      await appWindow.setFocus()
    }
    modeListeners.forEach((callback) => callback(mode))
  }

  // Resizes the window for the HUD scale, keeping the bottom-right corner in place.
  async function setHudScale(scale) {
    const factor = Math.max(1, scale)
    const width = Math.round(BASE_WIDTH * factor)
    const height = Math.round(Math.min(BASE_HEIGHT * factor, window.screen.availHeight - 2 * SCREEN_MARGIN))
    const dpr = await appWindow.scaleFactor()
    const pos = (await appWindow.outerPosition()).toLogical(dpr)
    const size = (await appWindow.innerSize()).toLogical(dpr)
    if (Math.round(size.width) === width && Math.round(size.height) === height) return
    await appWindow.setSize(new LogicalSize(width, height))
    await appWindow.setPosition(
      new LogicalPosition(pos.x + size.width - width, Math.max(0, pos.y + size.height - height)),
    )
  }

  appWindow.setIgnoreCursorEvents(true)

  // WebView2 drops the first click on an inactive window, so focus it on hover.
  window.addEventListener('mousemove', () => {
    if (mode === 'settings' && !document.hasFocus()) appWindow.setFocus()
  })

  unregisterAll().then(async () => {
    await register(MODE_SHORTCUT, (event) => {
      if (event.state === 'Pressed') setMode(mode === 'toast' ? 'settings' : 'toast')
    })
    if (DEV_TOOLS) {
      await register(TEST_TOAST_SHORTCUT, (event) => {
        if (event.state === 'Pressed') testToastListeners.forEach((callback) => callback())
      })
    }
  })

  window.aion2Watcher = {
    start: (character, iface) => invoke('watcher_start', { character, iface }),
    onEvent: (callback) => {
      const unlisten = listen('watcher:event', (event) => callback(event.payload))
      return () => unlisten.then((off) => off())
    },
    diagnose: () => invoke('watcher_diagnose'),
  }

  window.aion2Overlay = {
    close: () => appWindow.close(),
    openUrl,
    getMode: async () => mode,
    setMode,
    setHudScale,
    onMode: (callback) => subscribe(modeListeners, callback),
    onTestToast: (callback) => subscribe(testToastListeners, callback),
  }
}

if ('__TAURI_INTERNALS__' in window) installBridge()
