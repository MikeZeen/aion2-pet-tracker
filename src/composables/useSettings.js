import { computed, reactive, watchEffect } from 'vue'
import { MESSAGES } from '../i18n/messages'

export const SIZES = [
  { id: 'small', scale: 0.85 },
  { id: 'medium', scale: 1 },
  { id: 'large', scale: 1.2 },
]

// "r, g, b" triples. Dark uses a light highlight so bars stay visible on the dark box.
export const TINTS = [
  { id: 'white', rgb: '255, 255, 255' },
  { id: 'dark', rgb: '10, 10, 10', highlight: '200, 200, 200' },
  { id: 'blue', rgb: '140, 200, 255' },
  { id: 'purple', rgb: '195, 160, 255' },
  { id: 'green', rgb: '140, 225, 170' },
  { id: 'gold', rgb: '243, 217, 139' },
  { id: 'rose', rgb: '255, 160, 185' },
]

export const OPACITY_MIN = 0
export const OPACITY_MAX = 100
const OPACITY_DEFAULT = 60

// Box background: a dark shade mixed with the tint, so white text stays readable.
const BOX_DARK = [18, 20, 26]
const BOX_TINT_SHARE = 0.25

// Sizes are tuned for 1080p; taller screens scale the overlay up proportionally.
const REFERENCE_SCREEN_HEIGHT = 1080
const screenFactor = Math.max(1, (window.screen?.height || REFERENCE_SCREEN_HEIGHT) / REFERENCE_SCREEN_HEIGHT)

// The system language on first launch, e.g. "de-AT" -> "de".
function detectLanguage() {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = String(tag).toLowerCase().split('-')[0]
    if (MESSAGES[base]) return base
  }
  return 'en'
}

function boxColor(tintRgb) {
  const tint = tintRgb.split(',').map(Number)
  return BOX_DARK.map((dark, i) => Math.round(dark * (1 - BOX_TINT_SHARE) + tint[i] * BOX_TINT_SHARE)).join(', ')
}

const SETTINGS = {
  character: { key: 'aion2-watcher-character', fallback: '' },
  iface: { key: 'aion2-watcher-iface', fallback: '' },
  size: { key: 'aion2-overlay-size', fallback: 'medium' },
  tint: { key: 'aion2-overlay-tint', fallback: 'white' },
  opacity: { key: 'aion2-overlay-opacity', fallback: String(OPACITY_DEFAULT) },
  language: { key: 'aion2-overlay-language', fallback: detectLanguage() },
}

function read(name) {
  const { key, fallback } = SETTINGS[name]
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

const state = reactive(Object.fromEntries(Object.keys(SETTINGS).map((name) => [name, read(name)])))

const hudScale = computed(() => {
  const size = SIZES.find((s) => s.id === state.size) ?? SIZES[1]
  return size.scale * screenFactor
})

watchEffect(() => {
  const tint = TINTS.find((t) => t.id === state.tint) ?? TINTS[0]
  const parsed = Number(state.opacity)
  const opacity = Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, Number.isFinite(parsed) ? parsed : OPACITY_DEFAULT))
  const root = document.documentElement.style
  root.setProperty('--hud-scale', String(hudScale.value))
  root.setProperty('--tint', tint.rgb)
  root.setProperty('--tint-hl', tint.highlight ?? tint.rgb)
  root.setProperty('--hud-box', boxColor(tint.rgb))
  root.setProperty('--hud-opacity', String(opacity / 100))
})

export function useSettings() {
  // Saves the values and returns the names of the settings that changed.
  function apply(values) {
    const changed = []
    for (const [name, raw] of Object.entries(values)) {
      if (!(name in SETTINGS)) continue
      const value = String(raw ?? '').trim()
      if (value === state[name]) continue
      state[name] = value
      changed.push(name)
      try {
        localStorage.setItem(SETTINGS[name].key, value)
      } catch {
        // storage unavailable
      }
    }
    return changed
  }

  return { state, apply, hudScale }
}
