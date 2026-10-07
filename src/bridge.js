// Exposes window.aion2Watcher and window.aion2Overlay inside the desktop app.
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { availableMonitors, getCurrentWindow, LogicalPosition, LogicalSize, PhysicalPosition } from '@tauri-apps/api/window'
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { openUrl } from '@tauri-apps/plugin-opener'
import { DEV_TOOLS } from './devTools'

const MODE_SHORTCUT = 'CommandOrControl+Shift+M'
const TEST_TOAST_SHORTCUT = 'CommandOrControl+Shift+T'

// Must match WINDOW_WIDTH/HEIGHT in main.rs.
const BASE_WIDTH = 420
const BASE_HEIGHT = 640
const SCREEN_MARGIN = 16

// The overlay's bottom-right corner in physical pixels: the point the HUD scale keeps in place.
const CORNER_KEY = 'aion2-overlay-corner'
const SAVE_DELAY_MS = 500

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

  // Moves the window back to where it was left, if that spot is still on a screen.
  async function restorePosition() {
    try {
      const corner = JSON.parse(localStorage.getItem(CORNER_KEY))
      if (!corner) return
      const onScreen = (await availableMonitors()).some(
        ({ position: p, size: s }) =>
          corner.x > p.x && corner.x <= p.x + s.width && corner.y > p.y && corner.y <= p.y + s.height,
      )
      if (!onScreen) return
      const size = await appWindow.outerSize()
      await appWindow.setPosition(new PhysicalPosition(corner.x - size.width, corner.y - size.height))
    } catch {
      // storage unavailable or nothing saved
    }
  }

  let saveTimer = null
  function savePositionSoon() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      // Windows parks minimized windows far off-screen.
      if (await appWindow.isMinimized()) return
      const pos = await appWindow.outerPosition()
      const size = await appWindow.outerSize()
      try {
        localStorage.setItem(CORNER_KEY, JSON.stringify({ x: pos.x + size.width, y: pos.y + size.height }))
      } catch {
        // storage unavailable
      }
    }, SAVE_DELAY_MS)
  }

  // The window starts hidden so it doesn't jump from the default spot.
  const restored = restorePosition().finally(() => {
    appWindow.show()
    appWindow.onMoved(savePositionSoon)
  })

  // Resizes the window for the HUD scale, keeping the bottom-right corner in place.
  async function setHudScale(scale) {
    await restored
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
